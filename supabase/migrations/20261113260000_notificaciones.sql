-- =====================================================================
-- Notificaciones del ciclo de vida de la juntada (creación, inicio, fin)
-- + envío de push al celular
-- =====================================================================

create type tipo_notificacion as enum ('creada', 'iniciada', 'finalizada');

create table public.notificaciones (
  id            bigint generated always as identity primary key,
  perfil_id     uuid not null references public.perfiles(id) on delete cascade,
  juntada_id    uuid references public.juntadas(id) on delete cascade,
  tipo          tipo_notificacion not null,
  titulo        text not null,
  cuerpo        text not null,
  url           text not null,
  leida         boolean not null default false,
  push_enviada  boolean not null default false,
  creado_en     timestamptz not null default now()
);
create index notificaciones_perfil_idx on public.notificaciones (perfil_id, creado_en desc);
create index notificaciones_push_idx on public.notificaciones (push_enviada) where not push_enviada;

alter table public.notificaciones enable row level security;
-- cada uno ve y marca como leídas solo las suyas; nadie las crea desde la app (las crea el disparador)
create policy "notif_lectura_propia" on public.notificaciones
  for select to authenticated using (perfil_id = auth.uid());
create policy "notif_marcar_leida" on public.notificaciones
  for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
revoke update on public.notificaciones from authenticated;
grant  update (leida) on public.notificaciones to authenticated;

alter publication supabase_realtime add table public.notificaciones;

-- Hora "HH:MI" en Buenos Aires
create or replace function public.hora_ba(t timestamptz)
returns text language sql immutable as $$
  select to_char(t at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI');
$$;

-- Disparador: genera un aviso para cada miembro activo cuando la juntada se crea, arranca o termina
create or replace function public.notificar_juntada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tipo   tipo_notificacion;
  v_titulo text;
  v_cuerpo text;
  v_url    text;
  v_excluir uuid;
  v_n      int;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'creada';
    v_titulo := 'Nueva juntada: ' || new.nombre;
    v_cuerpo := to_char(new.inicio_programado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ' a las '
                || hora_ba(new.inicio_programado)
                || coalesce(' en ' || new.lugar, '') || '. ¿Vas?';
    v_url := '/juntada/' || new.id;
    v_excluir := new.anfitrion_id;  -- el que la crea no necesita el aviso
  elsif tg_op = 'UPDATE' and old.estado = 'propuesta' and new.estado = 'activa' then
    v_tipo := 'iniciada';
    v_titulo := '¡Arrancó ' || new.nombre || '!';
    v_cuerpo := 'Ya está en curso' || coalesce(' en ' || new.lugar, '') || '. Mostrá tu QR al llegar.';
    v_url := '/juntada/' || new.id;
  elsif tg_op = 'UPDATE' and old.estado = 'activa' and new.estado = 'finalizada' then
    select count(distinct perfil_id) into v_n from asistencias where juntada_id = new.id;
    v_tipo := 'finalizada';
    v_titulo := 'Terminó ' || new.nombre;
    v_cuerpo := 'Fueron ' || v_n || '. Tocá para ver el resumen completo.';
    v_url := '/juntada/' || new.id || '/resumen';
  else
    return new;
  end if;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, new.id, v_tipo, v_titulo, v_cuerpo, v_url
  from perfiles p
  where p.activo and p.id is distinct from v_excluir;
  return new;
end $$;

create trigger juntadas_notificar
  after insert or update of estado on public.juntadas
  for each row execute function public.notificar_juntada();

-- ---------- Push ----------
-- Suscripciones de cada celular (un usuario puede tener varios)
create table public.push_suscripciones (
  endpoint   text primary key,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  creado_en  timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
create policy "push_propia_lectura" on public.push_suscripciones
  for select to authenticated using (perfil_id = auth.uid());
create policy "push_propia_alta" on public.push_suscripciones
  for insert to authenticated with check (perfil_id = auth.uid());
create policy "push_propia_baja" on public.push_suscripciones
  for delete to authenticated using (perfil_id = auth.uid());

-- Configuración privada (la clave compartida con el servidor de la app). Nadie la lee desde la app.
create table public.config_privada (
  clave  text primary key,
  valor  text not null
);
alter table public.config_privada enable row level security;
revoke all on public.config_privada from anon, authenticated;

-- Arma el lote de push pendientes (avisos x celulares) y lo marca como enviado
create or replace function public.lote_push_pendiente()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lote jsonb;
begin
  with pendientes as (
    select id, perfil_id, titulo, cuerpo, url
    from notificaciones
    where not push_enviada and creado_en > now() - interval '1 hour'
    order by id
    limit 200
    for update skip locked
  ),
  marcar as (
    update notificaciones set push_enviada = true where id in (select id from pendientes)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'titulo', p.titulo, 'cuerpo', p.cuerpo, 'url', p.url)), '[]'::jsonb)
    into v_lote
  from pendientes p
  join push_suscripciones s on s.perfil_id = p.perfil_id;
  -- los viejos que quedaron sin enviar (ej: sin conexión) se dan por perdidos
  update notificaciones set push_enviada = true where not push_enviada and creado_en <= now() - interval '1 hour';
  return v_lote;
end $$;
revoke execute on function public.lote_push_pendiente() from public, anon, authenticated;
