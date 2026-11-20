-- Cuenta regresiva del Malariaso: un aviso por día con la foto del día.
-- Las fotos están en la app: /cr-db6d31288d68/NN.jpg (NN = días que faltan; 00 = el día del evento).

alter type tipo_notificacion add value if not exists 'cuenta';
alter table public.notificaciones add column if not exists imagen text;

-- el envío de push ahora lleva la imagen (si hay)
create or replace function public.lote_push_pendiente()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_lote jsonb;
begin
  with pendientes as (
    select id, perfil_id, titulo, cuerpo, url, imagen
    from notificaciones
    where not push_enviada and creado_en > now() - interval '1 hour'
    order by id
    limit 200
    for update skip locked
  ),
  marcar as (
    update notificaciones set push_enviada = true where id in (select id from pendientes)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
           'titulo', p.titulo, 'cuerpo', p.cuerpo, 'url', p.url, 'imagen', p.imagen)), '[]'::jsonb)
    into v_lote
  from pendientes p
  join push_suscripciones s on s.perfil_id = p.perfil_id;
  update notificaciones set push_enviada = true where not push_enviada and creado_en <= now() - interval '1 hour';
  return v_lote;
end $$;
revoke execute on function public.lote_push_pendiente() from public, anon, authenticated;

-- p_desde: la cuenta empieza cuando faltan esa cantidad de días (la foto más vieja)
create or replace function public.avisar_cuenta_regresiva(p_desde int default 32, p_hoy date default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hoy    date := coalesce(p_hoy, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  v_f      fechas_especiales%rowtype;
  v_inicio date;
  v_faltan int;
  v_n      int;
begin
  select * into v_f from fechas_especiales where nombre ilike '%malariaso%' order by id limit 1;
  if not found then return 0; end if;
  v_inicio := make_date(extract(year from v_hoy)::int, v_f.mes, v_f.dia);
  if v_inicio + (greatest(v_f.duracion_dias, 1) - 1) < v_hoy then
    v_inicio := make_date(extract(year from v_hoy)::int + 1, v_f.mes, v_f.dia);
  end if;
  v_faltan := v_inicio - v_hoy;
  if v_faltan < 0 or v_faltan > p_desde then return 0; end if;
  -- una sola vez por día
  if exists (select 1 from notificaciones where tipo = 'cuenta'
             and (creado_en at time zone 'America/Argentina/Buenos_Aires')::date = v_hoy) then
    return 0;
  end if;

  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url, imagen)
  select p.id, 'cuenta',
         case when v_faltan = 0 then '🦟 ¡Hoy arranca ' || v_f.nombre || '!'
              when v_faltan = 1 then '🦟 Falta 1 día para ' || v_f.nombre
              else '🦟 Faltan ' || v_faltan || ' días para ' || v_f.nombre end,
         case when v_faltan = 0 then 'Entrá a ver la foto del día.'
              else 'Entrá a ver la foto de hoy.' end,
         '/',
         '/cr-db6d31288d68/' || lpad(v_faltan::text, 2, '0') || '.jpg'
  from perfiles p
  where p.activo;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.avisar_cuenta_regresiva(int, date) from public, anon, authenticated;
