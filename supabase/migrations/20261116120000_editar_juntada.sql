-- Editar una juntada (quien la creó o un admin):
--  * propuesta: nombre, lugar, comida, hora y tolerancia
--  * en curso:  nombre, lugar y comida (la hora ya pasó)
--  * terminada: solo la comida (para completarla después)
-- Si cambia la hora o el lugar de una propuesta, se avisa a todos.
alter type tipo_notificacion add value if not exists 'cambio';

create policy "juntadas_editar_comida_finalizada" on public.juntadas
  for update to authenticated
  using (public.puede_gestionar(id) and estado = 'finalizada')
  with check (public.puede_gestionar(id));

create or replace function public.validar_edicion_juntada()
returns trigger language plpgsql set search_path = public as $$
begin
  -- solo se controla lo que edita la gente desde la app; los cambios de estado los hacen las funciones del sistema
  if current_user <> 'authenticated' or new.estado is distinct from old.estado then
    return new;
  end if;
  if old.estado = 'finalizada' and (new.nombre, new.lugar, new.inicio_programado, new.tolerancia_min)
       is distinct from (old.nombre, old.lugar, old.inicio_programado, old.tolerancia_min) then
    raise exception 'JUNTADA_CERRADA';
  end if;
  if old.estado = 'activa' and new.inicio_programado is distinct from old.inicio_programado then
    raise exception 'JUNTADA_CERRADA';
  end if;
  return new;
end $$;

create trigger juntadas_validar_edicion
  before update on public.juntadas
  for each row execute function public.validar_edicion_juntada();

create or replace function public.notificar_cambio_juntada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cuerpo text;
begin
  if current_setting('role', true) is distinct from 'authenticated' or new.estado <> 'propuesta' or new.estado is distinct from old.estado
     or (new.inicio_programado = old.inicio_programado and new.lugar is not distinct from old.lugar) then
    return new;
  end if;
  v_cuerpo := 'Ahora: ' || to_char(new.inicio_programado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
              || ' a las ' || hora_ba(new.inicio_programado)
              || coalesce(' en ' || new.lugar, '') || '.';
  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, new.id, 'cambio', 'Cambió ' || new.nombre, v_cuerpo, '/juntada/' || new.id
  from perfiles p
  where p.activo and p.id is distinct from auth.uid();
  return new;
end $$;

create trigger juntadas_notificar_cambio
  after update of inicio_programado, lugar on public.juntadas
  for each row execute function public.notificar_cambio_juntada();
