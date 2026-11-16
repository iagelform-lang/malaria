-- 1) El anfitrión (el que pone la casa y escanea los QR) puede ser otro que el que propone.
-- 2) La votación de fecha se define sola cuando una opción tiene mayoría del grupo.

-- ---------- Creador vs. anfitrión ----------
alter table public.juntadas add column creado_por uuid references public.perfiles(id);
update public.juntadas set creado_por = anfitrion_id where creado_por is null;
alter table public.juntadas alter column creado_por set default auth.uid();
alter table public.juntadas alter column creado_por set not null;

-- Gestiona la juntada: admin, anfitrión o quien la propuso
create or replace function public.puede_gestionar(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (select 1 from juntadas where id = p_juntada_id
                 and (anfitrion_id = auth.uid() or creado_por = auth.uid()));
$$;

drop policy "juntadas_proponer" on public.juntadas;
create policy "juntadas_proponer" on public.juntadas
  for insert to authenticated
  with check (creado_por = auth.uid() and estado = 'propuesta'
              and exists (select 1 from perfiles p where p.id = anfitrion_id and p.activo));
grant update (anfitrion_id) on public.juntadas to authenticated;

-- terminada: no se cambia el anfitrión; el nuevo anfitrión tiene que ser del grupo
create or replace function public.validar_edicion_juntada()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or new.estado is distinct from old.estado then
    return new;
  end if;
  if old.estado = 'finalizada'
     and (new.nombre, new.lugar, new.inicio_programado, new.tolerancia_min, new.anfitrion_id)
       is distinct from (old.nombre, old.lugar, old.inicio_programado, old.tolerancia_min, old.anfitrion_id) then
    raise exception 'JUNTADA_CERRADA';
  end if;
  if old.estado = 'activa' and new.inicio_programado is distinct from old.inicio_programado then
    raise exception 'JUNTADA_CERRADA';
  end if;
  if new.anfitrion_id is distinct from old.anfitrion_id
     and not exists (select 1 from perfiles where id = new.anfitrion_id and activo) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return new;
end $$;

-- El que propone y el anfitrión quedan anotados como que van, a la hora de inicio
create or replace function public.anotar_organizadores()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.inicio_programado <= now() then return new; end if;
  perform set_config('malaria.silencio', '1', true);
  insert into confirmaciones (juntada_id, perfil_id, va, hora_prometida)
  select new.id, x.id, true, new.inicio_programado
  from (select new.creado_por as id union select new.anfitrion_id) x
  on conflict (juntada_id, perfil_id) do nothing;
  perform set_config('malaria.silencio', '', true);
  return new;
end $$;
create trigger juntadas_anotar_organizadores after insert on public.juntadas
  for each row execute function public.anotar_organizadores();

-- El aviso de "nueva juntada" no le llega al que la propuso (sí al anfitrión si es otro)
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
                || coalesce(' en ' || new.lugar, '')
                || coalesce('. Se come: ' || new.comida, '') || '. ¿Vas?';
    v_url := '/juntada/' || new.id;
    v_excluir := new.creado_por;
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

-- ---------- Votación: en lo de quién, y mayoría automática ----------
alter table public.sondeos add column casa_de uuid references public.perfiles(id);

-- Arma la juntada con la fecha elegida (uso interno)
create or replace function public.cerrar_sondeo(p_opcion_id bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_s  sondeos%rowtype;
  v_o  sondeo_opciones%rowtype;
  v_j  uuid;
  v_lugar text;
begin
  select * into v_o from sondeo_opciones where id = p_opcion_id;
  if not found then raise exception 'SONDEO_INEXISTENTE'; end if;
  select * into v_s from sondeos where id = v_o.sondeo_id for update;
  if v_s.estado <> 'abierto' then raise exception 'SONDEO_CERRADO'; end if;
  if v_o.inicio <= now() then raise exception 'FECHA_PASADA'; end if;

  v_lugar := coalesce(v_s.lugar, (select 'Lo de ' || apodo from perfiles where id = v_s.casa_de));
  insert into juntadas (nombre, lugar, comida, inicio_programado, tolerancia_min, anfitrion_id, creado_por)
  values (v_s.nombre, v_lugar, v_s.comida, v_o.inicio, v_s.tolerancia_min,
          coalesce(v_s.casa_de, v_s.creado_por), v_s.creado_por)
  returning id into v_j;

  -- los que votaron esa fecha quedan anotados como que van (sin un aviso por persona)
  perform set_config('malaria.silencio', '1', true);
  insert into confirmaciones (juntada_id, perfil_id, va, hora_prometida)
  select v_j, perfil_id, true, v_o.inicio from sondeo_votos where opcion_id = v_o.id
  on conflict (juntada_id, perfil_id) do nothing;
  perform set_config('malaria.silencio', '', true);

  update sondeos set estado = 'cerrado', juntada_id = v_j where id = v_s.id;

  -- el que abrió la votación también se entera de que se definió
  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  values (v_s.creado_por, v_j, 'creada', 'Se definió: ' || v_s.nombre,
          to_char(v_o.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ' a las '
            || hora_ba(v_o.inicio) || coalesce(' en ' || v_lugar, '') || '.',
          '/juntada/' || v_j);
  return v_j;
end $$;
revoke execute on function public.cerrar_sondeo(bigint) from public, anon, authenticated;

-- Elegir a mano (el que la abrió o un admin)
create or replace function public.elegir_fecha(p_opcion_id bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_creador uuid;
begin
  select s.creado_por into v_creador
  from sondeo_opciones o join sondeos s on s.id = o.sondeo_id where o.id = p_opcion_id;
  if not found then raise exception 'SONDEO_INEXISTENTE'; end if;
  if v_creador <> auth.uid() and not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  return public.cerrar_sondeo(p_opcion_id);
end $$;

-- Cuántos votos hacen mayoría: más de la mitad de los miembros activos
create or replace function public.votos_para_mayoria()
returns int language sql stable security definer set search_path = public as $$
  select (count(*) / 2 + 1)::int from perfiles where activo;
$$;
grant execute on function public.votos_para_mayoria() to authenticated;

-- Cada voto: si esa fecha llegó a la mayoría, se arma la juntada sola
create or replace function public.mayoria_sondeo()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  select count(*) into v_n from sondeo_votos where opcion_id = new.opcion_id;
  if v_n >= public.votos_para_mayoria()
     and exists (select 1 from sondeo_opciones o join sondeos s on s.id = o.sondeo_id
                 where o.id = new.opcion_id and s.estado = 'abierto' and o.inicio > now()) then
    perform public.cerrar_sondeo(new.opcion_id);
  end if;
  return new;
end $$;
create trigger sondeo_votos_mayoria after insert on public.sondeo_votos
  for each row execute function public.mayoria_sondeo();
