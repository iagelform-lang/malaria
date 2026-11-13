-- Fechas importantes del grupo (se repiten todos los años). Las cargan los admins.
create table public.fechas_especiales (
  id          bigint generated always as identity primary key,
  nombre      text not null check (char_length(nombre) between 1 and 40),
  dia         smallint not null check (dia between 1 and 31),
  mes         smallint not null check (mes between 1 and 12),
  desde_anio  smallint check (desde_anio between 1950 and 2100),
  creado_en   timestamptz not null default now(),
  check (dia <= case when mes = 2 then 29 when mes in (4, 6, 9, 11) then 30 else 31 end)
);

alter table public.fechas_especiales enable row level security;
create policy "fechas_lectura" on public.fechas_especiales
  for select to authenticated using (true);
create policy "fechas_crear_admin" on public.fechas_especiales
  for insert to authenticated with check (public.es_admin());
create policy "fechas_editar_admin" on public.fechas_especiales
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "fechas_borrar_admin" on public.fechas_especiales
  for delete to authenticated using (public.es_admin());
