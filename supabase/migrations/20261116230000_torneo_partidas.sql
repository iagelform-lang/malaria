-- Los duelos quedan atados a su torneo: borrar el torneo (o "comenzar de nuevo") borra también sus duelos.
alter table public.partidas
  add column torneo_id bigint references public.torneos(id) on delete cascade;
create index partidas_torneo_idx on public.partidas (torneo_id);
