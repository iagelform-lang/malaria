-- El aviso de juntada creada / arrancó / terminó respeta el modo silencioso (malaria.silencio)
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
  -- pruebas y cargas del sistema: sin avisos
  if coalesce(current_setting('malaria.silencio', true), '') = '1' then
    return new;
  end if;

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

-- Al anotar al organizador como "voy", el modo silencioso se apaga solo si no estaba prendido de antes
create or replace function public.anotar_organizadores()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_previo text := coalesce(current_setting('malaria.silencio', true), '');
begin
  if new.inicio_programado <= now() then return new; end if;
  perform set_config('malaria.silencio', '1', true);
  insert into confirmaciones (juntada_id, perfil_id, va, hora_prometida)
  select new.id, x.id, true, new.inicio_programado
  from (select new.creado_por as id union select new.anfitrion_id) x
  on conflict (juntada_id, perfil_id) do nothing;
  perform set_config('malaria.silencio', v_previo, true);
  return new;
end $$;
