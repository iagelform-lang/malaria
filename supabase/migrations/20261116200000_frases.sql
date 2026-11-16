-- Frases célebres: lo que alguien dijo en una juntada. Se votan con un "me gusta"; el Wrapped muestra la más votada del año.
create table public.frases (
  id          bigint generated always as identity primary key,
  juntada_id  uuid not null references public.juntadas(id) on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,   -- quién la dijo
  texto       text not null check (char_length(texto) between 1 and 200),
  cargado_por uuid not null default auth.uid() references public.perfiles(id),
  creado_en   timestamptz not null default now()
);
create index frases_juntada_idx on public.frases (juntada_id, creado_en);

create table public.frase_votos (
  frase_id   bigint not null references public.frases(id) on delete cascade,
  perfil_id  uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  primary key (frase_id, perfil_id)
);

alter table public.frases enable row level security;
alter table public.frase_votos enable row level security;

create policy "frases_lectura" on public.frases for select to authenticated using (true);
-- se cargan durante o después de la juntada, por cualquier integrante
create policy "frases_cargar" on public.frases for insert to authenticated
  with check (cargado_por = auth.uid()
              and exists (select 1 from juntadas j where j.id = juntada_id and j.estado in ('activa', 'finalizada')));
create policy "frases_borrar" on public.frases for delete to authenticated
  using (cargado_por = auth.uid() or public.puede_gestionar(juntada_id));

create policy "frase_votos_lectura" on public.frase_votos for select to authenticated using (true);
create policy "frase_votos_votar" on public.frase_votos for insert to authenticated
  with check (perfil_id = auth.uid());
create policy "frase_votos_quitar" on public.frase_votos for delete to authenticated
  using (perfil_id = auth.uid());

alter publication supabase_realtime add table public.frases;
alter publication supabase_realtime add table public.frase_votos;
