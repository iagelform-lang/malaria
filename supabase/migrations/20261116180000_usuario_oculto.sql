-- Usuarios ocultos: cuentas que solo sirven para administrar la app (ej: "Admin").
-- No figuran como integrantes: no aparecen en listas ni estadísticas, no cuentan para la mayoría y no reciben avisos.
alter table public.perfiles add column oculto boolean not null default false;
update public.perfiles set oculto = true where apodo = 'Admin';

-- mayoría: solo integrantes de verdad
create or replace function public.votos_para_mayoria()
returns int language sql stable security definer set search_path = public as $$
  select (count(*) / 2 + 1)::int from perfiles where activo and not oculto;
$$;

-- ningún aviso para las cuentas ocultas (vale para todos los tipos de aviso)
create or replace function public.sin_avisos_ocultos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from perfiles where id = new.perfil_id and oculto) then
    return null;
  end if;
  return new;
end $$;
create trigger notificaciones_sin_ocultos before insert on public.notificaciones
  for each row execute function public.sin_avisos_ocultos();
