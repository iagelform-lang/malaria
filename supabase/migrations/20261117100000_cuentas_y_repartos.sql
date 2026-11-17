-- Gastos al estilo Splid:
-- 1) cada gasto se puede dividir solo entre algunos ("entre")
-- 2) cuentas sueltas fuera de una juntada (viajes, compras en común)
-- 3) pagos "en general" para saldar el saldo acumulado entre todos

-- 2) Cuentas sueltas
create table public.cuentas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 60),
  emoji       text not null default '💸' check (char_length(emoji) <= 8),
  miembros    uuid[] not null check (cardinality(miembros) >= 2),
  creado_por  uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);

create or replace function public.es_miembro_cuenta(p_cuenta_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cuentas where id = p_cuenta_id and auth.uid() = any (miembros));
$$;

create or replace function public.gestiona_cuenta(p_cuenta_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (select 1 from cuentas where id = p_cuenta_id and creado_por = auth.uid());
$$;

alter table public.cuentas enable row level security;
create policy cuentas_ver on public.cuentas
  for select to authenticated using (true);
create policy cuentas_crear on public.cuentas
  for insert to authenticated
  with check (creado_por = auth.uid() and (auth.uid() = any (miembros) or public.es_admin()));
create policy cuentas_editar on public.cuentas
  for update to authenticated
  using (public.gestiona_cuenta(id) or auth.uid() = any (miembros))
  with check (cardinality(miembros) >= 2);
create policy cuentas_borrar on public.cuentas
  for delete to authenticated using (public.gestiona_cuenta(id));
revoke update on public.cuentas from authenticated;
grant update (nombre, emoji, miembros) on public.cuentas to authenticated;

-- 1) y 2) Consumos: en una juntada O en una cuenta, y opcionalmente solo entre algunos
alter table public.consumos alter column juntada_id drop not null;
alter table public.consumos
  add column cuenta_id uuid references public.cuentas(id) on delete cascade,
  add column entre uuid[] check (entre is null or cardinality(entre) >= 1),
  add constraint consumos_un_lugar check (num_nonnulls(juntada_id, cuenta_id) = 1);
create index consumos_cuenta_idx on public.consumos (cuenta_id);
grant update (tipo, descripcion, monto, pagado_por, entre) on public.consumos to authenticated;

drop policy "consumos_cargar" on public.consumos;
drop policy "consumos_editar" on public.consumos;
drop policy "consumos_borrar" on public.consumos;

create policy "consumos_cargar" on public.consumos
  for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and case
      when juntada_id is not null then
        public.juntada_con_gastos(juntada_id)
        and (public.es_participante(juntada_id) or public.puede_gestionar(juntada_id))
      else public.es_miembro_cuenta(cuenta_id) or public.gestiona_cuenta(cuenta_id)
    end);
create policy "consumos_editar" on public.consumos
  for update to authenticated
  using (cargado_por = auth.uid()
         or (juntada_id is not null and public.puede_gestionar(juntada_id))
         or (cuenta_id is not null and public.gestiona_cuenta(cuenta_id)))
  with check ((juntada_id is null or public.juntada_con_gastos(juntada_id))
              and (cargado_por = auth.uid()
                   or (juntada_id is not null and public.puede_gestionar(juntada_id))
                   or (cuenta_id is not null and public.gestiona_cuenta(cuenta_id))));
create policy "consumos_borrar" on public.consumos
  for delete to authenticated
  using (cargado_por = auth.uid()
         or (juntada_id is not null and public.puede_gestionar(juntada_id))
         or (cuenta_id is not null and public.gestiona_cuenta(cuenta_id)));

-- 3) Pagos: de una juntada, de una cuenta, o en general (ninguno de los dos)
alter table public.pagos alter column juntada_id drop not null;
alter table public.pagos
  add column cuenta_id uuid references public.cuentas(id) on delete cascade,
  add constraint pagos_un_lugar check (num_nonnulls(juntada_id, cuenta_id) <= 1);
create index pagos_cuenta_idx on public.pagos (cuenta_id);

drop policy "pagos_registrar" on public.pagos;
drop policy "pagos_deshacer" on public.pagos;
create policy "pagos_registrar" on public.pagos
  for insert to authenticated
  with check (registrado_por = auth.uid()
              and (auth.uid() in (de_perfil, a_perfil)
                   or public.es_admin()
                   or (juntada_id is not null and public.puede_gestionar(juntada_id))
                   or (cuenta_id is not null and public.gestiona_cuenta(cuenta_id))));
create policy "pagos_deshacer" on public.pagos
  for delete to authenticated
  using (auth.uid() in (de_perfil, a_perfil, registrado_por)
         or public.es_admin()
         or (juntada_id is not null and public.puede_gestionar(juntada_id))
         or (cuenta_id is not null and public.gestiona_cuenta(cuenta_id)));

alter publication supabase_realtime add table public.cuentas;
