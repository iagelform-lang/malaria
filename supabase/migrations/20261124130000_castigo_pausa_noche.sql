-- Castigo por no votar: de noche no resta. Cuenta solo las horas que se cumplen
-- entre las 9 y las 00 (hora de Buenos Aires), igual que la foto de la cuenta regresiva.
-- Se recalcula siempre con esta regla, así que lo ya acumulado de noche se devuelve.

create or replace function public.horas_castigables(p_desde timestamptz, p_hasta timestamptz)
returns int language sql immutable set search_path = public as $$
  select count(*)::int
  from generate_series(1, greatest(floor(extract(epoch from (p_hasta - p_desde)) / 3600)::int, 0)) k
  where extract(hour from (p_desde + k * interval '1 hour') at time zone 'America/Argentina/Buenos_Aires') >= 9;
$$;
revoke execute on function public.horas_castigables(timestamptz, timestamptz) from public, anon;

create or replace function public.castigar_sin_voto(p_ahora timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with deudores as (
    select s.id as sondeo_id, s.nombre, p.id as perfil_id,
           horas_castigables(s.creado_en, p_ahora) as horas
    from sondeos s
    cross join perfiles p
    where s.estado = 'abierto'
      and p.activo and not p.oculto
      and not exists (
        select 1 from sondeo_votos v join sondeo_opciones o on o.id = v.opcion_id
        where o.sondeo_id = s.id and v.perfil_id = p.id)
  ),
  nuevos as (
    insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
    select d.perfil_id, 'castigo',
           'Votá la fecha: ' || d.nombre,
           'Perdés 1 punto por cada hora sin votar (de 9 a 00). Ya van -' || d.horas || '.',
           '/sondeo/' || d.sondeo_id
    from deudores d
    where d.horas >= 1
      and not exists (select 1 from castigos_voto c where c.sondeo_id = d.sondeo_id and c.perfil_id = d.perfil_id)
    returning 1
  )
  insert into castigos_voto (sondeo_id, perfil_id, puntos, actualizado_en)
  select d.sondeo_id, d.perfil_id, -d.horas, p_ahora
  from deudores d
  where d.horas >= 1
  on conflict (sondeo_id, perfil_id)
  do update set puntos = excluded.puntos, actualizado_en = excluded.actualizado_en
  where excluded.puntos <> castigos_voto.puntos;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.castigar_sin_voto(timestamptz) from public, anon, authenticated;
