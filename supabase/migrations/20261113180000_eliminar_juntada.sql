-- Un admin puede eliminar una juntada (en cualquier estado) con todos sus registros
create or replace function public.eliminar_juntada(p_juntada_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  delete from juntadas where id = p_juntada_id;  -- asistencias y confirmaciones se borran en cascada
  if not found then raise exception 'JUNTADA_INEXISTENTE'; end if;
end $$;
revoke execute on function public.eliminar_juntada(uuid) from public, anon;
grant  execute on function public.eliminar_juntada(uuid) to authenticated;
