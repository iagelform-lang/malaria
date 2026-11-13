-- Cualquiera del grupo puede cargar fechas (ej: su cumpleaños).
-- Cada uno borra/edita las suyas; los admins, todas.
alter table public.fechas_especiales
  add column creado_por uuid default auth.uid() references public.perfiles(id) on delete set null;

drop policy "fechas_crear_admin"  on public.fechas_especiales;
drop policy "fechas_editar_admin" on public.fechas_especiales;
drop policy "fechas_borrar_admin" on public.fechas_especiales;

create policy "fechas_crear" on public.fechas_especiales
  for insert to authenticated with check (creado_por = auth.uid());
create policy "fechas_editar" on public.fechas_especiales
  for update to authenticated
  using (creado_por = auth.uid() or public.es_admin())
  with check (creado_por = auth.uid() or public.es_admin());
create policy "fechas_borrar" on public.fechas_especiales
  for delete to authenticated using (creado_por = auth.uid() or public.es_admin());
