-- =====================================================================
-- Juntadas App — Migración 0001: esquema inicial (v2)
-- Supabase / PostgreSQL 15+
-- Tablas: perfiles, credenciales_qr, juntadas, confirmaciones, asistencias
-- Un solo grupo. Cualquiera propone juntadas. Puntualidad = llegó a la hora que dijo.
-- Toda escritura de asistencias pasa por funciones RPC (no hay INSERT directo)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type rol_usuario      as enum ('admin', 'invitado');
create type estado_juntada   as enum ('propuesta', 'activa', 'finalizada', 'cancelada');
create type origen_registro  as enum ('qr', 'manual', 'auto_fin', 'auto_12h');

-- ---------- Tablas ----------

-- 1 fila por usuario de auth.users (se crea sola con el trigger de abajo)
create table public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  apodo       text not null check (char_length(apodo) between 1 and 24),
  avatar_url  text,
  rol         rol_usuario not null default 'invitado',
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- El QR NO codifica el id del usuario sino un token rotable.
-- Separado en otra tabla para que nadie pueda leer el token de otro.
create table public.credenciales_qr (
  perfil_id  uuid primary key references public.perfiles(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  rotado_en  timestamptz not null default now()
);

-- Ciclo de vida: propuesta → activa → finalizada   (o propuesta → cancelada)
create table public.juntadas (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (char_length(nombre) between 1 and 60),
  lugar              text,
  inicio_programado  timestamptz not null,
  tolerancia_min     int not null default 15 check (tolerancia_min between 0 and 180),
  estado             estado_juntada not null default 'propuesta',
  anfitrion_id       uuid not null references public.perfiles(id),   -- quien la propuso
  iniciada_en        timestamptz,
  finalizada_en      timestamptz,
  creado_en          timestamptz not null default now(),
  check ((estado = 'finalizada') = (finalizada_en is not null)),
  check (estado in ('propuesta', 'cancelada') or iniciada_en is not null)
);

-- Solo puede haber UNA juntada activa a la vez (habilita el link "/activa").
-- Propuestas puede haber muchas.
create unique index una_juntada_activa on public.juntadas (estado) where estado = 'activa';
create index juntadas_inicio_idx on public.juntadas (inicio_programado);

-- "A qué hora dijo que llegaba" cada uno. Base de la puntualidad.
create table public.confirmaciones (
  juntada_id      uuid not null references public.juntadas(id) on delete cascade,
  perfil_id       uuid not null references public.perfiles(id) on delete cascade,
  hora_prometida  timestamptz not null,
  actualizado_en  timestamptz not null default now(),
  primary key (juntada_id, perfil_id)
);

-- Una fila = una "sesión" (entrada → salida). Permite salir y volver a entrar.
create table public.asistencias (
  id                      bigint generated always as identity primary key,
  juntada_id              uuid not null references public.juntadas(id) on delete cascade,
  perfil_id               uuid not null references public.perfiles(id) on delete cascade,
  entrada                 timestamptz not null default now(),
  salida                  timestamptz,
  origen_entrada          origen_registro not null default 'qr',
  origen_salida           origen_registro,
  entrada_registrada_por  uuid references public.perfiles(id),
  salida_registrada_por   uuid references public.perfiles(id),
  duracion_min            int generated always as (
                            case when salida is null then null
                                 else (extract(epoch from (salida - entrada)) / 60)::int end
                          ) stored,
  check (salida is null or salida >= entrada),
  check ((salida is null) = (origen_salida is null))
);

-- Nadie puede tener dos sesiones abiertas en la misma juntada
create unique index una_sesion_abierta on public.asistencias (juntada_id, perfil_id) where salida is null;
create index asistencias_perfil_idx  on public.asistencias (perfil_id);
create index asistencias_juntada_idx on public.asistencias (juntada_id);

-- ---------- Alta automática de perfil + QR ----------
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, apodo)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'apodo', ''),
                  nullif(split_part(new.email, '@', 1), ''),
                  'amigo'), 24)
  );
  insert into credenciales_qr (perfil_id) values (new.id);
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- Helpers de permisos ----------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo);
$$;

-- Gestiona una juntada: quien la propuso, o un admin
create or replace function public.puede_gestionar(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (select 1 from juntadas where id = p_juntada_id and anfitrion_id = auth.uid());
$$;

create or replace function public.juntada_abierta(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from juntadas where id = p_juntada_id and estado in ('propuesta', 'activa'));
$$;

-- ---------- RPC: ciclo de vida de la juntada ----------
create or replace function public.iniciar_juntada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar(p_juntada_id) then raise exception 'NO_AUTORIZADO'; end if;
  if exists (select 1 from juntadas where estado = 'activa' and id <> p_juntada_id) then
    raise exception 'YA_HAY_UNA_ACTIVA';
  end if;

  update juntadas
     set estado = 'activa', iniciada_en = now()
   where id = p_juntada_id and estado = 'propuesta';
  if not found then raise exception 'NO_ESTA_PROPUESTA'; end if;
  -- quien arranca la juntada está ahí: queda registrada su entrada
  insert into asistencias (juntada_id, perfil_id, origen_entrada, entrada_registrada_por)
  values (p_juntada_id, auth.uid(), 'manual', auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.cancelar_juntada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar(p_juntada_id) then raise exception 'NO_AUTORIZADO'; end if;
  update juntadas set estado = 'cancelada'
   where id = p_juntada_id and estado = 'propuesta';
  if not found then raise exception 'NO_ESTA_PROPUESTA'; end if;
end $$;

create or replace function public.finalizar_juntada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar(p_juntada_id) then raise exception 'NO_AUTORIZADO'; end if;

  update asistencias
     set salida = now(), origen_salida = 'auto_fin', salida_registrada_por = auth.uid()
   where juntada_id = p_juntada_id and salida is null;

  update juntadas
     set estado = 'finalizada', finalizada_en = now()
   where id = p_juntada_id and estado = 'activa';
  if not found then raise exception 'NO_ESTA_ACTIVA'; end if;
end $$;

-- ---------- RPC: escaneo de QR (entrada/salida atómica) ----------
create or replace function public.registrar_escaneo(p_juntada_id uuid, p_token uuid)
returns table (r_accion text, r_perfil_id uuid, r_apodo text, r_duracion_min int)
language plpgsql security definer set search_path = public as $$
declare
  v_perfil_id   uuid;
  v_apodo       text;
  v_abierta_id  bigint;
  v_ultimo      timestamptz;
  v_dur         int;
begin
  if not puede_gestionar(p_juntada_id) then
    raise exception 'NO_AUTORIZADO';
  end if;

  -- bloquea la juntada: serializa escaneos simultáneos
  perform 1 from juntadas where id = p_juntada_id and estado = 'activa' for update;
  if not found then
    raise exception 'JUNTADA_NO_ACTIVA';
  end if;

  select p.id, p.apodo into v_perfil_id, v_apodo
  from credenciales_qr c
  join perfiles p on p.id = c.perfil_id
  where c.token = p_token and p.activo;

  if v_perfil_id is null then
    raise exception 'QR_INVALIDO';
  end if;

  -- anti doble lectura: la cámara lee el mismo QR varias veces por segundo
  select max(greatest(a.entrada, coalesce(a.salida, a.entrada))) into v_ultimo
  from asistencias a
  where a.juntada_id = p_juntada_id and a.perfil_id = v_perfil_id;

  if v_ultimo is not null and now() - v_ultimo < interval '60 seconds' then
    return query select 'ignorado'::text, v_perfil_id, v_apodo, null::int;
    return;
  end if;

  select a.id into v_abierta_id
  from asistencias a
  where a.juntada_id = p_juntada_id and a.perfil_id = v_perfil_id and a.salida is null;

  if v_abierta_id is null then
    insert into asistencias (juntada_id, perfil_id, entrada_registrada_por)
    values (p_juntada_id, v_perfil_id, auth.uid());
    return query select 'entrada'::text, v_perfil_id, v_apodo, null::int;
  else
    update asistencias
       set salida = now(), origen_salida = 'qr', salida_registrada_por = auth.uid()
     where id = v_abierta_id
    returning duracion_min into v_dur;
    return query select 'salida'::text, v_perfil_id, v_apodo, v_dur;
  end if;
end $$;

-- ---------- RPC: salida manual (con hora opcional: "se fue a las 2") ----------
create or replace function public.marcar_salida_manual(p_asistencia_id bigint, p_hora timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare
  v asistencias%rowtype;
begin
  select * into v from asistencias where id = p_asistencia_id for update;
  if not found then raise exception 'ASISTENCIA_INEXISTENTE'; end if;
  if not puede_gestionar(v.juntada_id) then raise exception 'NO_AUTORIZADO'; end if;
  if v.salida is not null then raise exception 'YA_TIENE_SALIDA'; end if;
  if p_hora < v.entrada or p_hora > now() + interval '1 minute' then
    raise exception 'HORA_INVALIDA';
  end if;

  update asistencias
     set salida = p_hora, origen_salida = 'manual', salida_registrada_por = auth.uid()
   where id = p_asistencia_id;
end $$;

-- ---------- Job (cada 15 min): cierres automáticos ----------
create or replace function public.cerrar_vencidas()
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  -- 1) activas con más de 12 h desde el inicio: cerrar sesiones y finalizar
  update asistencias a
     set salida = greatest(a.entrada, j.inicio_programado + interval '12 hours'),
         origen_salida = 'auto_12h'
    from juntadas j
   where a.juntada_id = j.id
     and a.salida is null
     and j.estado = 'activa'
     and now() > j.inicio_programado + interval '12 hours';
  get diagnostics n = row_count;

  update juntadas
     set estado = 'finalizada', finalizada_en = now()
   where estado = 'activa' and now() > inicio_programado + interval '12 hours';

  -- 2) propuestas que nunca arrancaron y ya pasaron 12 h: cancelar
  update juntadas
     set estado = 'cancelada'
   where estado = 'propuesta' and now() > inicio_programado + interval '12 hours';

  return n;
end $$;

-- ---------- RPC: regenerar mi QR (si se filtró una captura) ----------
create or replace function public.rotar_mi_qr()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  update credenciales_qr
     set token = gen_random_uuid(), rotado_en = now()
   where perfil_id = auth.uid()
  returning token into v_token;
  return v_token;
end $$;

-- ---------- Permisos de ejecución ----------
revoke execute on function public.cerrar_vencidas() from public, anon, authenticated;

revoke execute on function public.iniciar_juntada(uuid)                     from public, anon;
revoke execute on function public.cancelar_juntada(uuid)                    from public, anon;
revoke execute on function public.finalizar_juntada(uuid)                   from public, anon;
revoke execute on function public.registrar_escaneo(uuid, uuid)             from public, anon;
revoke execute on function public.marcar_salida_manual(bigint, timestamptz) from public, anon;
revoke execute on function public.rotar_mi_qr()                             from public, anon;

grant execute on function public.iniciar_juntada(uuid)                     to authenticated;
grant execute on function public.cancelar_juntada(uuid)                    to authenticated;
grant execute on function public.finalizar_juntada(uuid)                   to authenticated;
grant execute on function public.registrar_escaneo(uuid, uuid)             to authenticated;
grant execute on function public.marcar_salida_manual(bigint, timestamptz) to authenticated;
grant execute on function public.rotar_mi_qr()                             to authenticated;

-- ---------- RLS ----------
alter table public.perfiles        enable row level security;
alter table public.credenciales_qr enable row level security;
alter table public.juntadas        enable row level security;
alter table public.confirmaciones  enable row level security;
alter table public.asistencias     enable row level security;

-- perfiles: todos ven a todos; cada uno edita SOLO apodo y avatar (no su rol)
create policy "perfiles_lectura" on public.perfiles
  for select to authenticated using (true);
create policy "perfiles_editar_propio" on public.perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.perfiles from authenticated;
grant  update (apodo, avatar_url) on public.perfiles to authenticated;

-- credenciales_qr: cada uno ve únicamente su propio token
create policy "qr_solo_propio" on public.credenciales_qr
  for select to authenticated using (perfil_id = auth.uid());

-- juntadas: todos leen; CUALQUIERA propone (queda como anfitrión);
-- se editan datos básicos solo mientras no esté finalizada/cancelada.
-- El cambio de estado va SOLO por las RPC (por eso no se otorga UPDATE de estado)
create policy "juntadas_lectura" on public.juntadas
  for select to authenticated using (true);
create policy "juntadas_proponer" on public.juntadas
  for insert to authenticated
  with check (anfitrion_id = auth.uid() and estado = 'propuesta');
create policy "juntadas_editar_gestor" on public.juntadas
  for update to authenticated
  using (public.puede_gestionar(id) and estado in ('propuesta', 'activa'))
  with check (public.puede_gestionar(id));
revoke update on public.juntadas from authenticated;
grant  update (nombre, lugar, inicio_programado, tolerancia_min) on public.juntadas to authenticated;

-- confirmaciones: todos leen ("Juan dijo 21:30"); cada uno carga/cambia la suya
-- SOLO antes de la hora que había dicho (no se puede corregir después de llegar tarde)
create policy "confirmaciones_lectura" on public.confirmaciones
  for select to authenticated using (true);
create policy "confirmaciones_crear_propia" on public.confirmaciones
  for insert to authenticated
  with check (perfil_id = auth.uid()
              and hora_prometida > now()
              and public.juntada_abierta(juntada_id));
create policy "confirmaciones_editar_propia" on public.confirmaciones
  for update to authenticated
  using (perfil_id = auth.uid() and hora_prometida > now())
  with check (perfil_id = auth.uid()
              and hora_prometida > now()
              and public.juntada_abierta(juntada_id));
create policy "confirmaciones_borrar_propia" on public.confirmaciones
  for delete to authenticated
  using (perfil_id = auth.uid() and hora_prometida > now());

-- asistencias: todos leen; nadie escribe directo (solo vía RPC security definer)
create policy "asistencias_lectura" on public.asistencias
  for select to authenticated using (true);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.asistencias, public.juntadas, public.confirmaciones;

-- ---------- Vista de estadísticas ----------
-- Solo juntadas finalizadas (las canceladas no cuentan para nada).
-- Las salidas 'auto_12h' NO suman horas ni cuentan para "último en apagar la luz".
-- Puntualidad: primera entrada <= hora que dijo (+ tolerancia).
--   Si no dijo hora, se compara contra el inicio de la juntada.
create or replace view public.v_estadisticas with (security_invoker = true) as
with por_juntada as (
  select a.perfil_id,
         a.juntada_id,
         min(a.entrada) as primera_entrada,
         max(a.salida)       filter (where a.origen_salida in ('qr','manual','auto_fin')) as ultima_salida,
         sum(a.duracion_min) filter (where a.origen_salida in ('qr','manual','auto_fin')) as minutos,
         min(a.entrada) <= coalesce(c.hora_prometida, j.inicio_programado)
                           + make_interval(mins => j.tolerancia_min)                     as puntual,
         (c.hora_prometida is not null)                                                  as habia_dicho_hora
  from asistencias a
  join juntadas j on j.id = a.juntada_id
  left join confirmaciones c on c.juntada_id = a.juntada_id and c.perfil_id = a.perfil_id
  where j.estado = 'finalizada'
  group by a.perfil_id, a.juntada_id, j.inicio_programado, j.tolerancia_min, c.hora_prometida
),
primeros as (
  select distinct on (juntada_id) juntada_id, perfil_id
  from por_juntada
  order by juntada_id, primera_entrada
),
ultimos as (
  select distinct on (juntada_id) juntada_id, perfil_id
  from por_juntada
  where ultima_salida is not null
  order by juntada_id, ultima_salida desc
),
plantones as (
  -- dijo a qué hora venía y nunca apareció
  select c.perfil_id, count(*) as veces_planto
  from confirmaciones c
  join juntadas j on j.id = c.juntada_id and j.estado = 'finalizada'
  where not exists (select 1 from asistencias a
                    where a.juntada_id = c.juntada_id and a.perfil_id = c.perfil_id)
  group by c.perfil_id
),
posibles as (
  -- juntadas a las que "podía" ir: posteriores a su alta, o a las que efectivamente fue
  select p.id as perfil_id, count(j.id) as juntadas_posibles
  from perfiles p
  left join juntadas j
    on j.estado = 'finalizada'
   and (j.inicio_programado >= p.creado_en
        or exists (select 1 from asistencias a where a.juntada_id = j.id and a.perfil_id = p.id))
  group by p.id
)
select p.id    as perfil_id,
       p.apodo,
       count(pj.juntada_id)                                                    as juntadas_asistidas,
       po.juntadas_posibles,
       round(100.0 * count(pj.juntada_id) / nullif(po.juntadas_posibles, 0), 1) as pct_asistencia,
       round(coalesce(sum(pj.minutos), 0) / 60.0, 1)                           as horas_totales,
       round(avg(pj.minutos))                                                  as promedio_min_por_juntada,
       round(100.0 * count(*) filter (where pj.puntual)
             / nullif(count(pj.juntada_id), 0), 1)                             as pct_puntualidad,
       count(*) filter (where pj.habia_dicho_hora)                             as veces_dijo_hora,
       (select count(*) from primeros pr where pr.perfil_id = p.id)            as veces_primero,
       (select count(*) from ultimos  u  where u.perfil_id  = p.id)            as veces_ultimo,
       coalesce(pl.veces_planto, 0)                                            as veces_planto,
       (po.juntadas_posibles >= 3)                                             as elegible_fantasma
from perfiles p
join posibles po on po.perfil_id = p.id
left join por_juntada pj on pj.perfil_id = p.id
left join plantones pl on pl.perfil_id = p.id
where p.activo
group by p.id, p.apodo, po.juntadas_posibles, pl.veces_planto;

-- =====================================================================
-- Pasos manuales post-migración
-- 1) Habilitar pg_cron (Dashboard → Database → Extensions) y programar:
--    select cron.schedule('cerrar-juntadas-vencidas', '*/15 * * * *',
--                         $$select public.cerrar_vencidas()$$);
-- 2) Promover al primer admin (después de loguearte una vez):
--    update public.perfiles set rol = 'admin' where apodo = 'ramiro';
-- =====================================================================
