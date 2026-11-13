-- Pantalla "Grupo": un admin puede hacer admin a otro y desactivar/reactivar miembros

create or replace function public.cambiar_rol(p_perfil_id uuid, p_rol rol_usuario)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_rol = 'invitado'
     and not exists (select 1 from perfiles where rol = 'admin' and activo and id <> p_perfil_id) then
    raise exception 'ULTIMO_ADMIN';
  end if;
  update perfiles set rol = p_rol where id = p_perfil_id;
  if not found then raise exception 'PERFIL_INEXISTENTE'; end if;
end $$;

create or replace function public.cambiar_activo(p_perfil_id uuid, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'NO_AUTORIZADO'; end if;
  if p_perfil_id = auth.uid() and not p_activo then raise exception 'NO_A_SI_MISMO'; end if;
  update perfiles set activo = p_activo where id = p_perfil_id;
  if not found then raise exception 'PERFIL_INEXISTENTE'; end if;
  -- si estaba adentro de una juntada en curso, se le cierra la sesión
  if not p_activo then
    update asistencias set salida = now(), origen_salida = 'manual', salida_registrada_por = auth.uid()
     where perfil_id = p_perfil_id and salida is null;
  end if;
end $$;

revoke execute on function public.cambiar_rol(uuid, rol_usuario)  from public, anon;
revoke execute on function public.cambiar_activo(uuid, boolean)   from public, anon;
grant  execute on function public.cambiar_rol(uuid, rol_usuario)  to authenticated;
grant  execute on function public.cambiar_activo(uuid, boolean)   to authenticated;
