-- Cada 15 minutos revisa a quién hay que recordarle que vote
select cron.schedule('recordar-votos', '*/15 * * * *', $$select public.recordar_votos()$$);
