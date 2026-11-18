-- Menos recordatorios: como máximo DOS por persona y por juntada.
--   1º: una hora después de creada la juntada (nunca antes de las 9).
--   2º: el mismo día de la juntada, desde las 10 (y con 3 h de diferencia con el 1º).
-- Antes era uno cada 3 horas hasta que votaras: eran la mitad de todos los avisos.
-- p_ahora existe solo para poder probarla con otra hora; el cron la llama sin parámetros.

drop function if exists public.recordar_votos();

create or replace function public.recordar_votos(p_ahora timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := p_ahora at time zone 'America/Argentina/Buenos_Aires';
  v_hora  int := extract(hour from v_local);
  v_n     int;
begin
  if v_hora < 9 then return 0; end if;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url, creado_en)
  select p.id, j.id, 'recordatorio',
         case when x.enviados = 0 then 'Falta tu voto: ' else 'Es hoy y falta tu voto: ' end || j.nombre,
         case when x.enviados = 0
              then to_char(j.inicio_programado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ' a las '
                   || hora_ba(j.inicio_programado) || '. Decí si vas o no vas.'
              else 'Hoy a las ' || hora_ba(j.inicio_programado) || '. Último aviso: decí si vas o no vas.'
         end,
         '/juntada/' || j.id,
         p_ahora
  from juntadas j
  cross join perfiles p
  cross join lateral (
    select count(*) as enviados, max(n.creado_en) as ultimo
    from notificaciones n
    where n.juntada_id = j.id and n.perfil_id = p.id and n.tipo = 'recordatorio'
  ) x
  where j.estado = 'propuesta'
    and j.creado_en <= p_ahora - interval '1 hour'
    and j.inicio_programado > p_ahora
    and p.activo
    and p.id <> j.anfitrion_id
    and p.id is distinct from j.creado_por
    and not exists (select 1 from confirmaciones c where c.juntada_id = j.id and c.perfil_id = p.id)
    and (
      x.enviados = 0
      or (x.enviados = 1
          and (j.inicio_programado at time zone 'America/Argentina/Buenos_Aires')::date = v_local::date
          and v_hora >= 10
          and x.ultimo <= p_ahora - interval '3 hours')
    );
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.recordar_votos(timestamptz) from public, anon, authenticated;
