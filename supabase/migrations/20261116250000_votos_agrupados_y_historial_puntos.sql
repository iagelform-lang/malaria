-- 1) Avisos de voto agrupados
--    Cada voto entra a una cola. Cada 10 minutos sale UN aviso por juntada
--    con los votos nuevos y el conteo. Cuando ya votaron todos, sale al toque.

create table public.votos_pendientes (
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  va          boolean not null,
  cambio      boolean not null default false,
  creado_en   timestamptz not null default now(),
  primary key (juntada_id, perfil_id)
);
alter table public.votos_pendientes enable row level security;
-- sin políticas: solo la usan las funciones del sistema

create or replace function public.resumir_votos(p_juntada_id uuid, p_final boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_j       juntadas%rowtype;
  v_van     text;
  v_novan   text;
  v_n_van   int;
  v_n_novan int;
  v_faltan  int;
  v_titulo  text;
  v_cuerpo  text;
  v_unico   uuid;
begin
  select * into v_j from juntadas where id = p_juntada_id;
  if not found or v_j.estado not in ('propuesta', 'activa') then
    delete from votos_pendientes where juntada_id = p_juntada_id;
    return;
  end if;
  if not exists (select 1 from votos_pendientes where juntada_id = p_juntada_id) then
    return;
  end if;

  select string_agg(p.apodo || case when v.cambio then ' (cambió)' else '' end, ', ' order by v.creado_en)
         filter (where v.va),
         string_agg(p.apodo || case when v.cambio then ' (cambió)' else '' end, ', ' order by v.creado_en)
         filter (where not v.va)
    into v_van, v_novan
  from votos_pendientes v join perfiles p on p.id = v.perfil_id
  where v.juntada_id = p_juntada_id;

  select count(*) filter (where c.va), count(*) filter (where not c.va)
    into v_n_van, v_n_novan
  from confirmaciones c where c.juntada_id = p_juntada_id;

  select count(*) into v_faltan
  from perfiles p
  where p.activo and not p.oculto
    and not exists (select 1 from confirmaciones c where c.juntada_id = p_juntada_id and c.perfil_id = p.id);

  v_titulo := case when p_final or v_faltan = 0
                   then '🗳️ Ya votaron todos: ' || v_j.nombre
                   else '🗳️ Votos nuevos en ' || v_j.nombre end;
  v_cuerpo := concat_ws(' · ',
                case when v_van is not null then 'Van: ' || v_van end,
                case when v_novan is not null then 'No van: ' || v_novan end)
              || E'\n' || 'Total: ' || v_n_van || ' van, ' || v_n_novan || ' no van'
              || case when v_faltan > 0 then ', faltan ' || v_faltan else '' end || '.';

  -- si en la tanda votó una sola persona, a ella no le avisamos su propio voto
  select case when count(*) = 1 then min(perfil_id::text)::uuid end into v_unico
  from votos_pendientes where juntada_id = p_juntada_id;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, p_juntada_id, 'voto', v_titulo, v_cuerpo, '/juntada/' || p_juntada_id
  from perfiles p
  where p.activo and p.id is distinct from v_unico;

  delete from votos_pendientes where juntada_id = p_juntada_id;
end $$;

create or replace function public.resumir_votos_pendientes()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct juntada_id from votos_pendientes loop
    perform resumir_votos(r.juntada_id);
  end loop;
end $$;

create or replace function public.notificar_voto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_j      juntadas%rowtype;
  v_faltan int;
begin
  if coalesce(current_setting('malaria.silencio', true), '') = '1' then
    return new;
  end if;
  -- solo respuestas nuevas o cambios de Voy <-> No voy (un cambio de hora no avisa)
  if tg_op = 'UPDATE' and old.va = new.va then
    return new;
  end if;
  select * into v_j from juntadas where id = new.juntada_id;
  -- el "voy" automático del anfitrión y del que la creó no avisa
  if tg_op = 'INSERT' and new.perfil_id in (v_j.anfitrion_id, coalesce(v_j.creado_por, v_j.anfitrion_id)) then
    return new;
  end if;

  insert into votos_pendientes (juntada_id, perfil_id, va, cambio)
  values (new.juntada_id, new.perfil_id, new.va, tg_op = 'UPDATE')
  on conflict (juntada_id, perfil_id)
  do update set va = excluded.va, cambio = votos_pendientes.cambio or excluded.cambio;

  -- si con este voto ya respondieron todos, avisamos ahora mismo
  select count(*) into v_faltan
  from perfiles p
  where p.activo and not p.oculto
    and not exists (select 1 from confirmaciones c where c.juntada_id = new.juntada_id and c.perfil_id = p.id);
  if v_faltan = 0 then
    perform resumir_votos(new.juntada_id, true);
  end if;
  return new;
end $$;

-- 2) Historial de cambios de puntos

create table public.cambios_puntos (
  id          bigint generated always as identity primary key,
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  perfil_id   uuid references public.perfiles(id) on delete set null,
  de          int not null,
  a           int not null,
  creado_en   timestamptz not null default now()
);
create index cambios_puntos_juntada_idx on public.cambios_puntos (juntada_id, creado_en);
alter table public.cambios_puntos enable row level security;
create policy cambios_puntos_ver on public.cambios_puntos
  for select to authenticated using (true);
grant select on public.cambios_puntos to authenticated;

create or replace function public.registrar_cambio_puntos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.puntos is distinct from old.puntos then
    insert into cambios_puntos (juntada_id, perfil_id, de, a)
    values (new.id, auth.uid(), coalesce(old.puntos, 10), coalesce(new.puntos, 10));
  end if;
  return new;
end $$;

create trigger juntadas_cambio_puntos
  after update of puntos on public.juntadas
  for each row execute function public.registrar_cambio_puntos();
