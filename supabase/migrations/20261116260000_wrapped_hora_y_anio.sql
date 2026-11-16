-- El cron de Supabase corre en hora UTC: las 23 h de Argentina del 31/12 son las 02 h UTC del 1/1.
-- El aviso lleva el año en el link, así abrirlo después de medianoche no muestra el año nuevo vacío.
create or replace function public.avisar_wrapped()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_anio int := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires') - interval '2 hours');
begin
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
  select p.id, 'wrapped', 'Malaria Wrapped ' || v_anio,
         'Ya está el resumen del año: quién fue a más juntadas, quién llegó tarde, cuánto gastamos.',
         '/wrapped?anio=' || v_anio
  from perfiles p where p.activo;
end $$;
revoke execute on function public.avisar_wrapped() from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'avisar-wrapped'), schedule := '0 2 1 1 *');
