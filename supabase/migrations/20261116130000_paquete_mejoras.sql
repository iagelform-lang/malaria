-- Paquete de mejoras: alias para transferir, aviso 1 h antes, qué llevar, fotos, Wrapped y votar fecha
alter type tipo_notificacion add value if not exists 'llegada';
alter type tipo_notificacion add value if not exists 'sondeo';
alter type tipo_notificacion add value if not exists 'wrapped';

-- ---------- Alias para transferir ----------
alter table public.perfiles
  add column alias text check (alias is null or char_length(alias) between 3 and 60);
grant update (alias) on public.perfiles to authenticated;

-- ---------- Aviso 1 hora antes de la hora que dijo ----------
create or replace function public.recordar_llegadas()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select c.perfil_id, j.id, 'llegada',
         'En 1 hora: ' || j.nombre,
         'Dijiste que llegabas a las ' || hora_ba(c.hora_prometida) || coalesce(' a ' || j.lugar, '') || '.',
         '/juntada/' || j.id
  from confirmaciones c
  join juntadas j on j.id = c.juntada_id
  where c.va
    and j.estado in ('propuesta', 'activa')
    and c.hora_prometida > now()
    and c.hora_prometida <= now() + interval '1 hour'
    and not exists (select 1 from asistencias a where a.juntada_id = j.id and a.perfil_id = c.perfil_id)
    and not exists (select 1 from notificaciones n
                    where n.juntada_id = j.id and n.perfil_id = c.perfil_id and n.tipo = 'llegada');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.recordar_llegadas() from public, anon, authenticated;

-- ---------- Qué llevar ----------
create table public.llevar (
  id          bigint generated always as identity primary key,
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  item        text not null check (char_length(item) between 1 and 40),
  perfil_id   uuid references public.perfiles(id) on delete set null,   -- quién lo lleva (null = nadie todavía)
  creado_por  uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);
create index llevar_juntada_idx on public.llevar (juntada_id);
alter table public.llevar enable row level security;
create policy "llevar_lectura" on public.llevar for select to authenticated using (true);
create policy "llevar_agregar" on public.llevar for insert to authenticated
  with check (creado_por = auth.uid() and public.juntada_abierta(juntada_id)
              and (perfil_id is null or perfil_id = auth.uid()));
-- anotarse (si está libre) o soltarlo (si es suyo)
create policy "llevar_anotarse" on public.llevar for update to authenticated
  using (public.juntada_abierta(juntada_id) and (perfil_id is null or perfil_id = auth.uid()))
  with check (perfil_id is null or perfil_id = auth.uid());
create policy "llevar_borrar" on public.llevar for delete to authenticated
  using (creado_por = auth.uid() or public.puede_gestionar(juntada_id));
revoke update on public.llevar from authenticated;
grant update (perfil_id) on public.llevar to authenticated;
alter publication supabase_realtime add table public.llevar;

-- ---------- Fotos (los archivos van al bucket "fotos"; acá queda el registro) ----------
create table public.fotos (
  id          bigint generated always as identity primary key,
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  ruta        text not null unique,
  subido_por  uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);
create index fotos_juntada_idx on public.fotos (juntada_id, creado_en);
alter table public.fotos enable row level security;
create policy "fotos_lectura" on public.fotos for select to authenticated using (true);
create policy "fotos_subir" on public.fotos for insert to authenticated
  with check (subido_por = auth.uid()
              and exists (select 1 from juntadas j where j.id = juntada_id and j.estado in ('activa', 'finalizada')));
create policy "fotos_borrar" on public.fotos for delete to authenticated
  using (subido_por = auth.uid() or public.puede_gestionar(juntada_id));
alter publication supabase_realtime add table public.fotos;

-- ---------- Votar la fecha ----------
create table public.sondeos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (char_length(nombre) between 1 and 60),
  lugar           text check (lugar is null or char_length(lugar) <= 80),
  comida          text check (comida is null or char_length(comida) between 1 and 60),
  tolerancia_min  int not null default 15 check (tolerancia_min between 0 and 180),
  creado_por      uuid not null default auth.uid() references public.perfiles(id),
  estado          text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  juntada_id      uuid references public.juntadas(id) on delete set null,
  creado_en       timestamptz not null default now()
);
create table public.sondeo_opciones (
  id         bigint generated always as identity primary key,
  sondeo_id  uuid not null references public.sondeos(id) on delete cascade,
  inicio     timestamptz not null,
  unique (sondeo_id, inicio)
);
create table public.sondeo_votos (
  opcion_id  bigint not null references public.sondeo_opciones(id) on delete cascade,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  primary key (opcion_id, perfil_id)
);
alter table public.sondeos enable row level security;
alter table public.sondeo_opciones enable row level security;
alter table public.sondeo_votos enable row level security;

create or replace function public.sondeo_abierto_mio(p_sondeo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sondeos where id = p_sondeo and estado = 'abierto'
                 and (creado_por = auth.uid() or public.es_admin()));
$$;
create or replace function public.opcion_abierta(p_opcion bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sondeo_opciones o join sondeos s on s.id = o.sondeo_id
                 where o.id = p_opcion and s.estado = 'abierto');
$$;

create policy "sondeos_lectura" on public.sondeos for select to authenticated using (true);
create policy "sondeos_crear" on public.sondeos for insert to authenticated
  with check (creado_por = auth.uid() and estado = 'abierto' and juntada_id is null);
create policy "sondeos_borrar" on public.sondeos for delete to authenticated
  using (creado_por = auth.uid() or public.es_admin());
create policy "opciones_lectura" on public.sondeo_opciones for select to authenticated using (true);
create policy "opciones_crear" on public.sondeo_opciones for insert to authenticated
  with check (public.sondeo_abierto_mio(sondeo_id) and inicio > now());
create policy "opciones_borrar" on public.sondeo_opciones for delete to authenticated
  using (public.sondeo_abierto_mio(sondeo_id));
create policy "votos_lectura" on public.sondeo_votos for select to authenticated using (true);
create policy "votos_votar" on public.sondeo_votos for insert to authenticated
  with check (perfil_id = auth.uid() and public.opcion_abierta(opcion_id));
create policy "votos_quitar" on public.sondeo_votos for delete to authenticated
  using (perfil_id = auth.uid() and public.opcion_abierta(opcion_id));
alter publication supabase_realtime add table public.sondeo_votos;

-- Aviso a todos cuando alguien abre una votación de fecha
create or replace function public.notificar_sondeo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
  select p.id, 'sondeo', 'Votá la fecha: ' || new.nombre,
         'Marcá qué días podés' || coalesce(' (' || new.comida || ')', '') || '.',
         '/sondeo/' || new.id
  from perfiles p
  where p.activo and p.id <> new.creado_por;
  return new;
end $$;
create trigger sondeos_notificar after insert on public.sondeos
  for each row execute function public.notificar_sondeo();

-- Elegir la fecha ganadora: crea la juntada y anota como "voy" a los que votaron esa fecha
create or replace function public.elegir_fecha(p_opcion_id bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_s  sondeos%rowtype;
  v_o  sondeo_opciones%rowtype;
  v_j  uuid;
begin
  select * into v_o from sondeo_opciones where id = p_opcion_id;
  if not found then raise exception 'SONDEO_INEXISTENTE'; end if;
  select * into v_s from sondeos where id = v_o.sondeo_id for update;
  if v_s.estado <> 'abierto' then raise exception 'SONDEO_CERRADO'; end if;
  if v_s.creado_por <> auth.uid() and not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if v_o.inicio <= now() then raise exception 'FECHA_PASADA'; end if;

  insert into juntadas (nombre, lugar, comida, inicio_programado, tolerancia_min, anfitrion_id)
  values (v_s.nombre, v_s.lugar, v_s.comida, v_o.inicio, v_s.tolerancia_min, v_s.creado_por)
  returning id into v_j;

  -- los "voy" automáticos no mandan un aviso por persona
  perform set_config('malaria.silencio', '1', true);
  insert into confirmaciones (juntada_id, perfil_id, va, hora_prometida)
  select v_j, x.perfil_id, true, v_o.inicio
  from (select v_s.creado_por as perfil_id
        union select perfil_id from sondeo_votos where opcion_id = v_o.id) x;
  perform set_config('malaria.silencio', '', true);

  update sondeos set estado = 'cerrado', juntada_id = v_j where id = v_s.id;
  return v_j;
end $$;
revoke execute on function public.elegir_fecha(bigint) from public, anon;
grant execute on function public.elegir_fecha(bigint) to authenticated;

-- notificar_voto respeta el "silencio" de elegir_fecha
create or replace function public.notificar_voto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_j      juntadas%rowtype;
  v_apodo  text;
  v_titulo text;
begin
  if coalesce(current_setting('malaria.silencio', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.va = new.va then
    return new;
  end if;
  select * into v_j from juntadas where id = new.juntada_id;
  if tg_op = 'INSERT' and new.perfil_id = v_j.anfitrion_id then
    return new;
  end if;
  select apodo into v_apodo from perfiles where id = new.perfil_id;

  v_titulo := case
    when new.va and tg_op = 'UPDATE' then v_apodo || ' ahora va a ' || v_j.nombre
    when new.va then v_apodo || ' va a ' || v_j.nombre
    when tg_op = 'UPDATE' then v_apodo || ' ya no va a ' || v_j.nombre
    else v_apodo || ' no va a ' || v_j.nombre
  end;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, new.juntada_id, 'voto', v_titulo,
         case when new.va then 'Dijo que llega a las ' || hora_ba(new.hora_prometida) || '.'
              else 'Tocá para ver quiénes van.' end,
         '/juntada/' || new.juntada_id
  from perfiles p
  where p.activo and p.id <> new.perfil_id;
  return new;
end $$;

-- ---------- Wrapped: aviso el 31/12 ----------
create or replace function public.avisar_wrapped()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_anio int := extract(year from now() at time zone 'America/Argentina/Buenos_Aires');
begin
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
  select p.id, 'wrapped', 'Malaria Wrapped ' || v_anio,
         'Ya está el resumen del año: quién fue a más juntadas, quién llegó tarde, cuánto gastamos.',
         '/wrapped'
  from perfiles p where p.activo;
end $$;
revoke execute on function public.avisar_wrapped() from public, anon, authenticated;
