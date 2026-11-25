-- 9, 11, 13, 15, 17, 19, 21 y 23 de Buenos Aires (UTC-3)
select cron.unschedule('cuenta-regresiva-malariaso')
where exists (select 1 from cron.job where jobname = 'cuenta-regresiva-malariaso');
select cron.schedule('cuenta-regresiva-malariaso', '1 0,2,12,14,16,18,20,22 * * *',
  $c$select public.avisar_cuenta_regresiva()$c$);
