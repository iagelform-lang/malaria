-- Juegos: partidas jugadas en cada juntada (truco, poker, FIFA, cartas, Terminator…) con ganador y resultado
create table public.partidas (
  id          bigint generated always as identity primary key,
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  juego       text not null check (char_length(juego) between 1 and 30),
  resultado   text check (resultado is null or char_length(resultado) <= 40),
  cargado_por uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);
create index partidas_juntada_idx on public.partidas (juntada_id, creado_en);

create table public.partida_jugadores (
  partida_id  bigint not null references public.partidas(id) on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  equipo      smallint not null default 1 check (equipo between 1 and 8),
  gano        boolean not null default false,
  primary key (partida_id, perfil_id)
);

alter table public.partidas enable row level security;
alter table public.partida_jugadores enable row level security;

-- carga partidas el que fue a la juntada (o quien la gestiona), mientras está en curso o después
create or replace function public.puede_cargar_partida(p_juntada_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from juntadas j where j.id = p_juntada_id and j.estado in ('activa', 'finalizada'))
     and (public.puede_gestionar(p_juntada_id)
          or exists (select 1 from asistencias a where a.juntada_id = p_juntada_id and a.perfil_id = auth.uid()));
$$;
create or replace function public.partida_mia(p_partida_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from partidas p where p.id = p_partida_id
                 and (p.cargado_por = auth.uid() or public.puede_gestionar(p.juntada_id)));
$$;

create policy "partidas_lectura" on public.partidas for select to authenticated using (true);
create policy "partidas_cargar" on public.partidas for insert to authenticated
  with check (cargado_por = auth.uid() and public.puede_cargar_partida(juntada_id));
create policy "partidas_editar" on public.partidas for update to authenticated
  using (public.partida_mia(id)) with check (public.partida_mia(id));
create policy "partidas_borrar" on public.partidas for delete to authenticated
  using (public.partida_mia(id));
revoke update on public.partidas from authenticated;
grant update (juego, resultado) on public.partidas to authenticated;

create policy "jugadores_lectura" on public.partida_jugadores for select to authenticated using (true);
create policy "jugadores_cargar" on public.partida_jugadores for insert to authenticated
  with check (public.partida_mia(partida_id));
create policy "jugadores_editar" on public.partida_jugadores for update to authenticated
  using (public.partida_mia(partida_id)) with check (public.partida_mia(partida_id));
create policy "jugadores_borrar" on public.partida_jugadores for delete to authenticated
  using (public.partida_mia(partida_id));

alter publication supabase_realtime add table public.partidas;
alter publication supabase_realtime add table public.partida_jugadores;
