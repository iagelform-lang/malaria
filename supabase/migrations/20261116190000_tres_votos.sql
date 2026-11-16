-- La fecha de una votación se define con 3 votos a la misma opción (no hace falta la mayoría del grupo).
-- Después, el resto responde si va o no en la juntada.
create or replace function public.votos_para_mayoria()
returns int language sql stable security definer set search_path = public as $$
  select 3;
$$;
