-- Partidas jugadas fuera de una juntada (ej: Bid Womens desde la pestaña Juegos)
alter table public.partidas alter column juntada_id drop not null;

drop policy "partidas_cargar" on public.partidas;
create policy "partidas_cargar" on public.partidas for insert to authenticated
  with check (
    cargado_por = auth.uid()
    and (
      (juntada_id is null and exists (select 1 from perfiles where id = auth.uid() and activo))
      or public.puede_cargar_partida(juntada_id)
    )
  );
