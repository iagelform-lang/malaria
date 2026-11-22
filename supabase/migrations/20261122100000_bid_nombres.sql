-- Bid Womens: lista compartida de nombres para sortear en las partidas.
-- La carga cualquiera del grupo (a mano o sola, con los nombres que se escriben en cada partida).

create table public.bid_nombres (
  id          bigint generated always as identity primary key,
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 40),
  -- sin repetidos, sin importar mayúsculas ni espacios (la app la usa para ignorar repetidos al guardar)
  clave       text generated always as (lower(btrim(nombre))) stored unique,
  cargado_por uuid default auth.uid() references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now()
);

alter table public.bid_nombres enable row level security;
create policy bid_nombres_ver on public.bid_nombres
  for select to authenticated using (true);
create policy bid_nombres_cargar on public.bid_nombres
  for insert to authenticated with check (cargado_por = auth.uid());
create policy bid_nombres_borrar on public.bid_nombres
  for delete to authenticated using (true);
revoke update on public.bid_nombres from authenticated;
