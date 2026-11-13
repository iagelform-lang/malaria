-- =====================================================================
-- Consumos de la juntada (comida, postre, bebida...), división de gastos
-- y registro de pagos entre amigos ("saldar")
-- =====================================================================

create type tipo_consumo as enum ('comida', 'postre', 'bebida', 'otro');

create table public.consumos (
  id           bigint generated always as identity primary key,
  juntada_id   uuid not null references public.juntadas(id) on delete cascade,
  tipo         tipo_consumo not null default 'comida',
  descripcion  text not null check (char_length(descripcion) between 1 and 80),
  monto        numeric(12,2) check (monto is null or monto >= 0),
  pagado_por   uuid references public.perfiles(id),
  cargado_por  uuid not null default auth.uid() references public.perfiles(id),
  creado_en    timestamptz not null default now(),
  check (monto is null or pagado_por is not null)
);
create index consumos_juntada_idx on public.consumos (juntada_id);

-- Gente que fue pero NO entra en la división (ej: llegó después de comer)
create table public.exclusiones_gasto (
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  primary key (juntada_id, perfil_id)
);

-- "Saldar": X le pagó a Y tanto, por las cuentas de esa juntada
create table public.pagos (
  id              bigint generated always as identity primary key,
  juntada_id      uuid not null references public.juntadas(id) on delete cascade,
  de_perfil       uuid not null references public.perfiles(id),
  a_perfil        uuid not null references public.perfiles(id),
  monto           numeric(12,2) not null check (monto > 0),
  registrado_por  uuid not null default auth.uid() references public.perfiles(id),
  creado_en       timestamptz not null default now(),
  check (de_perfil <> a_perfil)
);
create index pagos_juntada_idx on public.pagos (juntada_id);

-- ¿El usuario actual fue a esta juntada?
create or replace function public.es_participante(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from asistencias where juntada_id = p_juntada_id and perfil_id = auth.uid());
$$;

-- Se pueden cargar consumos en juntadas en curso o terminadas
create or replace function public.juntada_con_gastos(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from juntadas where id = p_juntada_id and estado in ('activa', 'finalizada'));
$$;

alter table public.consumos          enable row level security;
alter table public.exclusiones_gasto enable row level security;
alter table public.pagos             enable row level security;

-- consumos: todos leen; carga cualquiera que fue (o anfitrión/admin);
-- cada uno edita/borra lo que cargó, anfitrión y admins editan todo
create policy "consumos_lectura" on public.consumos
  for select to authenticated using (true);
create policy "consumos_cargar" on public.consumos
  for insert to authenticated
  with check (cargado_por = auth.uid()
              and public.juntada_con_gastos(juntada_id)
              and (public.es_participante(juntada_id) or public.puede_gestionar(juntada_id)));
create policy "consumos_editar" on public.consumos
  for update to authenticated
  using (cargado_por = auth.uid() or public.puede_gestionar(juntada_id))
  with check (public.juntada_con_gastos(juntada_id)
              and (cargado_por = auth.uid() or public.puede_gestionar(juntada_id)));
create policy "consumos_borrar" on public.consumos
  for delete to authenticated
  using (cargado_por = auth.uid() or public.puede_gestionar(juntada_id));
revoke update on public.consumos from authenticated;
grant  update (tipo, descripcion, monto, pagado_por) on public.consumos to authenticated;

-- exclusiones: todos leen; solo anfitrión/admin sacan o vuelven a poner gente
create policy "exclusiones_lectura" on public.exclusiones_gasto
  for select to authenticated using (true);
create policy "exclusiones_gestionar" on public.exclusiones_gasto
  for insert to authenticated with check (public.puede_gestionar(juntada_id));
create policy "exclusiones_quitar" on public.exclusiones_gasto
  for delete to authenticated using (public.puede_gestionar(juntada_id));

-- pagos: todos leen; lo registra el que paga, el que cobra, o anfitrión/admin
create policy "pagos_lectura" on public.pagos
  for select to authenticated using (true);
create policy "pagos_registrar" on public.pagos
  for insert to authenticated
  with check (registrado_por = auth.uid()
              and (auth.uid() in (de_perfil, a_perfil) or public.puede_gestionar(juntada_id)));
create policy "pagos_deshacer" on public.pagos
  for delete to authenticated
  using (auth.uid() in (de_perfil, a_perfil, registrado_por) or public.puede_gestionar(juntada_id));
revoke update on public.pagos from authenticated;

alter publication supabase_realtime add table public.consumos, public.exclusiones_gasto, public.pagos;
