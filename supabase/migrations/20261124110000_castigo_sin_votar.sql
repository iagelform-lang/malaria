-- Castigo por no votar la fecha: desde que se publica una votación, cada hora completa sin votar
-- resta 1 punto (las 24 horas, sin tope). Al votar o al cerrarse la votación, deja de restar.
-- Se recalcula cada 10 minutos: el número es siempre "horas sin votar", así que no se duplica.

alter type tipo_notificacion add value if not exists 'castigo';

create table public.castigos_voto (
  sondeo_id      uuid not null references public.sondeos(id) on delete cascade,
  perfil_id      uuid not null references public.perfiles(id) on delete cascade,
  puntos         int not null check (puntos <= 0),
  actualizado_en timestamptz not null default now(),
  primary key (sondeo_id, perfil_id)
);
alter table public.castigos_voto enable row level security;
create policy castigos_voto_ver on public.castigos_voto
  for select to authenticated using (true);
-- nadie lo toca a mano: lo maneja solo la función de abajo

create or replace function public.castigar_sin_voto(p_ahora timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with deudores as (
    select s.id as sondeo_id, s.nombre, p.id as perfil_id,
           floor(extract(epoch from (p_ahora - s.creado_en)) / 3600)::int as horas
    from sondeos s
    cross join perfiles p
    where s.estado = 'abierto'
      and p.activo and not p.oculto
      and not exists (
        select 1 from sondeo_votos v join sondeo_opciones o on o.id = v.opcion_id
        where o.sondeo_id = s.id and v.perfil_id = p.id)
  ),
  nuevos as (
    -- la primera vez que pierde puntos por esta votación, un aviso (uno solo)
    insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
    select d.perfil_id, 'castigo',
           'Votá la fecha: ' || d.nombre,
           'Perdés 1 punto por cada hora sin votar. Ya van -' || d.horas || '.',
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
  do update set puntos = least(castigos_voto.puntos, excluded.puntos), actualizado_en = excluded.actualizado_en
  where excluded.puntos < castigos_voto.puntos;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.castigar_sin_voto(timestamptz) from public, anon, authenticated;
