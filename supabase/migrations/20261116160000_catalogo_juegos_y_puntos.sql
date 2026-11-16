-- 1) Catálogo de juegos del grupo: vienen los predeterminados y cualquiera puede agregar
-- 2) Puntos por juntada: normal = 1, media = 5, importante = 10 (ej: cumpleaños). Ir a la juntada suma sus puntos.

create table public.juegos (
  id              bigint generated always as identity primary key,
  nombre          text not null check (char_length(nombre) between 1 and 30),
  emoji           text not null default '🏅' check (char_length(emoji) <= 8),
  modo            text not null default 'individual' check (modo in ('equipos', 'individual')),
  predeterminado  boolean not null default false,
  creado_por      uuid default auth.uid() references public.perfiles(id) on delete set null,
  creado_en       timestamptz not null default now()
);
create unique index juegos_nombre_unico on public.juegos (lower(nombre));

insert into public.juegos (nombre, emoji, modo, predeterminado, creado_por) values
  ('Truco', '🃏', 'equipos', true, null),
  ('Poker', '♠️', 'individual', true, null),
  ('FIFA', '🎮', 'equipos', true, null),
  ('Cartas', '🂡', 'individual', true, null),
  ('Juego de mesa', '🎲', 'individual', true, null),
  ('Terminator', '🤖', 'individual', true, null);

alter table public.juegos enable row level security;
create policy "juegos_lectura" on public.juegos for select to authenticated using (true);
create policy "juegos_agregar" on public.juegos for insert to authenticated
  with check (creado_por = auth.uid() and not predeterminado);
-- los agregados los borra quien los creó o un admin; los predeterminados solo un admin
create policy "juegos_borrar" on public.juegos for delete to authenticated
  using ((creado_por = auth.uid() and not predeterminado) or public.es_admin());
create policy "juegos_editar" on public.juegos for update to authenticated
  using (creado_por = auth.uid() or public.es_admin())
  with check (creado_por = auth.uid() or public.es_admin());
revoke update on public.juegos from authenticated;
grant update (emoji, modo) on public.juegos to authenticated;

-- ---------- Puntos ----------
alter table public.juntadas
  add column puntos smallint not null default 1 check (puntos in (1, 5, 10));
grant update (puntos) on public.juntadas to authenticated;
alter table public.sondeos
  add column puntos smallint not null default 1 check (puntos in (1, 5, 10));

-- la juntada que sale de una votación hereda los puntos
create or replace function public.cerrar_sondeo(p_opcion_id bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_s  sondeos%rowtype;
  v_o  sondeo_opciones%rowtype;
  v_j  uuid;
  v_lugar text;
begin
  select * into v_o from sondeo_opciones where id = p_opcion_id;
  if not found then raise exception 'SONDEO_INEXISTENTE'; end if;
  select * into v_s from sondeos where id = v_o.sondeo_id for update;
  if v_s.estado <> 'abierto' then raise exception 'SONDEO_CERRADO'; end if;
  if v_o.inicio <= now() then raise exception 'FECHA_PASADA'; end if;

  v_lugar := coalesce(v_s.lugar, (select 'Lo de ' || apodo from perfiles where id = v_s.casa_de));
  insert into juntadas (nombre, lugar, comida, inicio_programado, tolerancia_min, anfitrion_id, creado_por, puntos)
  values (v_s.nombre, v_lugar, v_s.comida, v_o.inicio, v_s.tolerancia_min,
          coalesce(v_s.casa_de, v_s.creado_por), v_s.creado_por, v_s.puntos)
  returning id into v_j;

  perform set_config('malaria.silencio', '1', true);
  insert into confirmaciones (juntada_id, perfil_id, va, hora_prometida)
  select v_j, perfil_id, true, v_o.inicio from sondeo_votos where opcion_id = v_o.id
  on conflict (juntada_id, perfil_id) do nothing;
  perform set_config('malaria.silencio', '', true);

  update sondeos set estado = 'cerrado', juntada_id = v_j where id = v_s.id;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  values (v_s.creado_por, v_j, 'creada', 'Se definió: ' || v_s.nombre,
          to_char(v_o.inicio at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') || ' a las '
            || hora_ba(v_o.inicio) || coalesce(' en ' || v_lugar, '') || '.',
          '/juntada/' || v_j);
  return v_j;
end $$;
revoke execute on function public.cerrar_sondeo(bigint) from public, anon, authenticated;

-- terminada: se pueden corregir los puntos (ej: era un cumple y quedó como normal); lo demás no
create or replace function public.validar_edicion_juntada()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' or new.estado is distinct from old.estado then
    return new;
  end if;
  if old.estado = 'finalizada'
     and (new.nombre, new.lugar, new.inicio_programado, new.tolerancia_min, new.anfitrion_id)
       is distinct from (old.nombre, old.lugar, old.inicio_programado, old.tolerancia_min, old.anfitrion_id) then
    raise exception 'JUNTADA_CERRADA';
  end if;
  if old.estado = 'activa' and new.inicio_programado is distinct from old.inicio_programado then
    raise exception 'JUNTADA_CERRADA';
  end if;
  if new.anfitrion_id is distinct from old.anfitrion_id
     and not exists (select 1 from perfiles where id = new.anfitrion_id and activo) then
    raise exception 'NO_AUTORIZADO';
  end if;
  return new;
end $$;
