-- Cada hora borra las ubicaciones en vivo de más de 12 horas
select cron.schedule('limpiar-ubicaciones', '17 * * * *', $c$select public.limpiar_ubicaciones_viejas()$c$);
