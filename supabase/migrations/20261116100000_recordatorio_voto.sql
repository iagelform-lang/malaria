-- Recordatorio a los que no votaron Voy / No voy.
-- Primer aviso 1 hora después de creada la juntada; después cada 3 horas, hasta que vote
-- o hasta que la juntada arranque. De noche (00 a 9 hs) no se manda nada.
alter type tipo_notificacion add value if not exists 'recordatorio';

create or replace function public.recordar_votos()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hora int := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  v_n    int;
begin
  if v_hora < 9 then return 0; end if;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, j.id, 'recordatorio',
         'Falta tu voto: ' || j.nombre,
         to_char(j.inicio_programado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ' a las '
           || hora_ba(j.inicio_programado) || '. Decí si vas o no vas.',
         '/juntada/' || j.id
  from juntadas j
  cross join perfiles p
  where j.estado = 'propuesta'
    and j.creado_en <= now() - interval '1 hour'
    and j.inicio_programado > now()
    and p.activo
    and p.id <> j.anfitrion_id
    and not exists (select 1 from confirmaciones c where c.juntada_id = j.id and c.perfil_id = p.id)
    and not exists (select 1 from notificaciones n
                    where n.juntada_id = j.id and n.perfil_id = p.id and n.tipo = 'recordatorio'
                      and n.creado_en > now() - interval '3 hours' + interval '1 minute');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.recordar_votos() from public, anon, authenticated;
