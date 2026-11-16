-- Nuevos valores de puntos: normal 10, salida 30, asado 50, viaje / cumpleaños 70.
-- Los eventos del grupo (El Malariaso, cumpleaños) también suman: el que marcó "Voy" suma los puntos del evento.

alter table public.juntadas drop constraint if exists juntadas_puntos_check;
update public.juntadas set puntos = case puntos when 1 then 10 when 5 then 30 when 10 then 70 else puntos end;
alter table public.juntadas alter column puntos set default 10;
alter table public.juntadas add constraint juntadas_puntos_check check (puntos in (10, 30, 50, 70));

alter table public.sondeos drop constraint if exists sondeos_puntos_check;
update public.sondeos set puntos = case puntos when 1 then 10 when 5 then 30 when 10 then 70 else puntos end;
alter table public.sondeos alter column puntos set default 10;
alter table public.sondeos add constraint sondeos_puntos_check check (puntos in (10, 30, 50, 70));

alter table public.fechas_especiales
  add column puntos smallint not null default 10 check (puntos in (10, 30, 50, 70));
-- los cumpleaños y El Malariaso valen 70
update public.fechas_especiales set puntos = 70
 where nombre ilike '%cumple%' or nombre ilike '%malariaso%';
