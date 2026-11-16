-- Cada uno elige qué avisos le suenan en el celular. Los silenciados igual quedan en la lista de Avisos de la app.
alter table public.perfiles add column avisos_off text[] not null default '{}';
grant update (avisos_off) on public.perfiles to authenticated;

create or replace function public.sin_avisos_ocultos()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_oculto boolean;
  v_off    text[];
begin
  select oculto, avisos_off into v_oculto, v_off from perfiles where id = new.perfil_id;
  if v_oculto then
    return null;                      -- cuentas ocultas: ningún aviso
  end if;
  if new.tipo::text = any (coalesce(v_off, '{}')) then
    new.push_enviada := true;         -- silenciado: queda en la app pero no suena el celular
  end if;
  return new;
end $$;
