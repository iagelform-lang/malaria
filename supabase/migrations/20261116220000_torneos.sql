-- Torneos eliminatorios (cuartos, semis, tercer puesto y final). Cada puesto suma puntos para el campeón de los juegos:
-- 1º 100 · 2º 55 · 3º 40 · 4º 25 · 5º a 8º 10.
create table public.torneos (
  id          bigint generated always as identity primary key,
  juego       text not null check (char_length(juego) between 1 and 30),
  juntada_id  uuid references public.juntadas(id) on delete set null,
  cargado_por uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);
create table public.torneo_posiciones (
  torneo_id  bigint not null references public.torneos(id) on delete cascade,
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  puesto     smallint not null check (puesto between 1 and 8),
  puntos     smallint not null check (puntos in (100, 55, 40, 25, 10)),
  primary key (torneo_id, perfil_id)
);
alter table public.torneos enable row level security;
alter table public.torneo_posiciones enable row level security;

create policy "torneos_lectura" on public.torneos for select to authenticated using (true);
create policy "torneos_cargar" on public.torneos for insert to authenticated
  with check (cargado_por = auth.uid() and exists (select 1 from perfiles where id = auth.uid() and activo));
create policy "torneos_borrar" on public.torneos for delete to authenticated
  using (cargado_por = auth.uid() or public.es_admin());

create policy "posiciones_lectura" on public.torneo_posiciones for select to authenticated using (true);
create policy "posiciones_cargar" on public.torneo_posiciones for insert to authenticated
  with check (exists (select 1 from torneos t where t.id = torneo_id and t.cargado_por = auth.uid())
              -- los puntos tienen que corresponder al puesto
              and puntos = case puesto when 1 then 100 when 2 then 55 when 3 then 40 when 4 then 25 else 10 end);
