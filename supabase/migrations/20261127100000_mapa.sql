-- Mapa del grupo: ubicación en vivo (opcional, cada uno la prende y la apaga) y la casa de cada uno.
-- Solo lo ven los integrantes logueados. Cada uno solo puede escribir lo suyo.

create table public.ubicaciones_vivo (
  perfil_id      uuid primary key references public.perfiles(id) on delete cascade default auth.uid(),
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  precision_m    real check (precision_m >= 0),
  actualizado_en timestamptz not null default now()
);

alter table public.ubicaciones_vivo enable row level security;

create policy "ubicaciones: las ven los del grupo" on public.ubicaciones_vivo
  for select to authenticated using (true);
create policy "ubicaciones: cada uno comparte la suya" on public.ubicaciones_vivo
  for insert to authenticated with check (perfil_id = auth.uid());
create policy "ubicaciones: cada uno actualiza la suya" on public.ubicaciones_vivo
  for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "ubicaciones: cada uno deja de compartir" on public.ubicaciones_vivo
  for delete to authenticated using (perfil_id = auth.uid());

-- la hora la pone la base, no el celular
create or replace function public.ubicacion_hora()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;
create trigger ubicacion_hora before insert or update on public.ubicaciones_vivo
  for each row execute function public.ubicacion_hora();

create table public.casas (
  perfil_id      uuid primary key references public.perfiles(id) on delete cascade default auth.uid(),
  lat            double precision not null check (lat between -90 and 90),
  lng            double precision not null check (lng between -180 and 180),
  direccion      text check (char_length(direccion) <= 160),
  actualizado_en timestamptz not null default now()
);

alter table public.casas enable row level security;

create policy "casas: las ven los del grupo" on public.casas
  for select to authenticated using (true);
create policy "casas: cada uno carga la suya" on public.casas
  for insert to authenticated with check (perfil_id = auth.uid());
create policy "casas: cada uno cambia la suya" on public.casas
  for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy "casas: cada uno borra la suya" on public.casas
  for delete to authenticated using (perfil_id = auth.uid());

create trigger casa_hora before insert or update on public.casas
  for each row execute function public.ubicacion_hora();

-- Privacidad: las ubicaciones en vivo viejas se borran solas
create or replace function public.limpiar_ubicaciones_viejas()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from ubicaciones_vivo where actualizado_en < now() - interval '12 hours';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.limpiar_ubicaciones_viejas() from public, anon, authenticated;

alter publication supabase_realtime add table public.ubicaciones_vivo, public.casas;
