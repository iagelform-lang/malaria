-- Sede de la fecha especial (ej: Hebraica)
alter table public.fechas_especiales
  add column lugar text check (lugar is null or char_length(lugar) between 1 and 60);
