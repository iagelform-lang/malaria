-- Aviso cuando alguien agrega un evento del grupo (cumpleaños, El Malariaso, etc.)
alter type tipo_notificacion add value if not exists 'evento';

create or replace function public.notificar_evento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
  select p.id, 'evento',
         'Nuevo evento: ' || new.nombre,
         nombre_rango_evento(new.dia, new.mes, coalesce(new.duracion_dias, 1))
           || coalesce(' en ' || new.lugar, '') || '. Marcá si vas.',
         '/grupo'
  from perfiles p
  where p.activo and p.id is distinct from new.creado_por;
  return new;
end $$;

-- "22/12" o "22/12 al 27/12"
create or replace function public.nombre_rango_evento(p_dia int, p_mes int, p_dur int)
returns text language sql immutable as $$
  select case when p_dur <= 1 then lpad(p_dia::text, 2, '0') || '/' || lpad(p_mes::text, 2, '0')
    else lpad(p_dia::text, 2, '0') || '/' || lpad(p_mes::text, 2, '0') || ' al '
         || to_char(make_date(2000, p_mes, p_dia) + (p_dur - 1), 'DD/MM')
  end;
$$;

create trigger fechas_notificar
  after insert on public.fechas_especiales
  for each row execute function public.notificar_evento();
