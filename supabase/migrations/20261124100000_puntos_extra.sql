-- Puntos extra: cualquiera le da (o le saca) puntos a otro integrante por algo que hizo.
-- Nadie se da puntos a sí mismo. Tope de ±100 por vez. Queda todo a la vista (quién, a quién, por qué).

alter type tipo_notificacion add value if not exists 'puntos';

create table public.puntos_extra (
  id          bigint generated always as identity primary key,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  puntos      int not null check (puntos between -100 and 100 and puntos <> 0),
  motivo      text not null check (char_length(btrim(motivo)) between 1 and 80),
  dado_por    uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  check (perfil_id <> dado_por)
);
create index puntos_extra_perfil_idx on public.puntos_extra (perfil_id);

alter table public.puntos_extra enable row level security;
create policy puntos_extra_ver on public.puntos_extra
  for select to authenticated using (true);
create policy puntos_extra_dar on public.puntos_extra
  for insert to authenticated
  with check (dado_por = auth.uid() and perfil_id <> auth.uid());
-- lo borra el que lo dio (si se equivocó) o un admin
create policy puntos_extra_borrar on public.puntos_extra
  for delete to authenticated
  using (dado_por = auth.uid() or public.es_admin());
revoke update on public.puntos_extra from authenticated;

-- aviso al que recibe: "Rama te dio +20: llevó el fernet"
create or replace function public.avisar_puntos_extra()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_quien text;
begin
  select apodo into v_quien from perfiles where id = new.dado_por;
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url)
  values (new.perfil_id, 'puntos',
          coalesce(v_quien, 'Alguien') || ' te ' || case when new.puntos > 0 then 'dio +' else 'sacó ' end
            || abs(new.puntos) || ' puntos',
          new.motivo,
          '/stats');
  return new;
end $$;

create trigger puntos_extra_aviso
  after insert on public.puntos_extra
  for each row execute function public.avisar_puntos_extra();
