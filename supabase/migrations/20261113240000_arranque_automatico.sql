-- Las juntadas se activan solas a la hora programada (job cada minuto).
-- El botón manual solo funciona si ya pasó la hora (por si el job se demora).

create or replace function public.iniciar_juntada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar(p_juntada_id) then raise exception 'NO_AUTORIZADO'; end if;
  if exists (select 1 from juntadas where id = p_juntada_id and now() < inicio_programado) then
    raise exception 'TODAVIA_NO';
  end if;
  if exists (select 1 from juntadas where estado = 'activa' and id <> p_juntada_id) then
    raise exception 'YA_HAY_UNA_ACTIVA';
  end if;
  update juntadas
     set estado = 'activa', iniciada_en = now()
   where id = p_juntada_id and estado = 'propuesta';
  if not found then raise exception 'NO_ESTA_PROPUESTA'; end if;
  insert into asistencias (juntada_id, perfil_id, origen_entrada, entrada_registrada_por)
  values (p_juntada_id, auth.uid(), 'manual', auth.uid())
  on conflict do nothing;
end $$;

-- Job: activa las propuestas cuya hora ya llegó (de a una: solo puede haber una activa)
create or replace function public.activar_programadas()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from juntadas
     where estado = 'propuesta'
       and inicio_programado <= now()
       and inicio_programado > now() - interval '12 hours'
     order by inicio_programado
  loop
    exit when exists (select 1 from juntadas where estado = 'activa');
    update juntadas set estado = 'activa', iniciada_en = now() where id = r.id and estado = 'propuesta';
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.activar_programadas() from public, anon, authenticated;

-- Al activarse sola nadie queda presente: el anfitrión/admin puede registrar su propia llegada
create or replace function public.registrar_mi_llegada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not puede_gestionar(p_juntada_id) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (select 1 from juntadas where id = p_juntada_id and estado = 'activa') then
    raise exception 'JUNTADA_NO_ACTIVA';
  end if;
  insert into asistencias (juntada_id, perfil_id, origen_entrada, entrada_registrada_por)
  values (p_juntada_id, auth.uid(), 'manual', auth.uid())
  on conflict do nothing;
end $$;
revoke execute on function public.registrar_mi_llegada(uuid) from public, anon;
grant  execute on function public.registrar_mi_llegada(uuid) to authenticated;
