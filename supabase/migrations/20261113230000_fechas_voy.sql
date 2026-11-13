-- Fechas que duran varios días + "Voy" por día
alter table public.fechas_especiales
  add column duracion_dias smallint not null default 1 check (duracion_dias between 1 and 14);

create table public.fechas_asistencia (
  fecha_id   bigint not null references public.fechas_especiales(id) on delete cascade,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  dia        date not null,
  creado_en  timestamptz not null default now(),
  primary key (fecha_id, perfil_id, dia)
);

alter table public.fechas_asistencia enable row level security;
create policy "voy_lectura" on public.fechas_asistencia
  for select to authenticated using (true);
-- cada uno marca solo sus días, y no días que ya pasaron
create policy "voy_marcar" on public.fechas_asistencia
  for insert to authenticated
  with check (perfil_id = auth.uid()
              and dia >= (now() at time zone 'America/Argentina/Buenos_Aires')::date);
create policy "voy_desmarcar" on public.fechas_asistencia
  for delete to authenticated using (perfil_id = auth.uid());

alter publication supabase_realtime add table public.fechas_asistencia;
