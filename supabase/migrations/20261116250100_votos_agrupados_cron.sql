-- Cada 10 minutos sale un aviso por juntada con los votos nuevos
select cron.schedule('resumir-votos', '*/10 * * * *', $$select public.resumir_votos_pendientes()$$);
