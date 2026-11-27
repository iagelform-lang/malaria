-- Cuando arranca una juntada, a los que votaron "voy" y no llegaron se les pide abrir el mapa y prender la ubicación.

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

  -- Al arrancar: a los que dijeron "voy" y todavía no llegaron, el aviso los lleva al mapa
  -- para que prendan la ubicación y el resto vea si están llegando.
  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, new.id, v_tipo, v_titulo,
         case when x.en_camino then 'Prendé tu ubicación en el mapa así ven si estás llegando. Al llegar, mostrá tu QR.' else v_cuerpo end,
         case when x.en_camino then '/mapa' else v_url end
  from perfiles p
  cross join lateral (
    select v_tipo = 'iniciada'
       and exists (select 1 from confirmaciones c where c.juntada_id = new.id and c.perfil_id = p.id and c.va)
       and not exists (select 1 from asistencias a where a.juntada_id = new.id and a.perfil_id = p.id) as en_camino
  ) x
  where p.activo and p.id is distinct from v_excluir;
  return new;
end $$;
