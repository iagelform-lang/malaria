-- Job (cada minuto): manda los push pendientes al servidor de la app, que los reenvía a cada celular.
-- Requiere: extensión pg_net y la clave compartida en config_privada ('push_secret').
create extension if not exists pg_net;

create or replace function public.enviar_push()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_secreto text;
  v_lote    jsonb;
begin
  select valor into v_secreto from config_privada where clave = 'push_secret';
  if v_secreto is null then return; end if;           -- todavía no configurado: no se pierde nada
  v_lote := lote_push_pendiente();
  if jsonb_array_length(v_lote) = 0 then return; end if;
  perform net.http_post(
    url     := 'https://malaria-six.vercel.app/api/push',
    body    := jsonb_build_object('items', v_lote),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secreto)
  );
end $$;
revoke execute on function public.enviar_push() from public, anon, authenticated;

select cron.schedule('enviar-push', '* * * * *', $$select public.enviar_push()$$);
