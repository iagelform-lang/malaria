-- Aviso a todo el grupo cuando alguien responde Voy / No voy (o cambia su respuesta)
alter type tipo_notificacion add value if not exists 'voto';

create or replace function public.notificar_voto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_j      juntadas%rowtype;
  v_apodo  text;
  v_titulo text;
begin
  -- solo respuestas nuevas o cambios de Voy <-> No voy (un cambio de hora no avisa)
  if tg_op = 'UPDATE' and old.va = new.va then
    return new;
  end if;
  select * into v_j from juntadas where id = new.juntada_id;
  -- el "voy" automático del que crea la juntada no avisa (ya avisó la creación)
  if tg_op = 'INSERT' and new.perfil_id = v_j.anfitrion_id then
    return new;
  end if;
  select apodo into v_apodo from perfiles where id = new.perfil_id;

  v_titulo := case
    when new.va and tg_op = 'UPDATE' then v_apodo || ' ahora va a ' || v_j.nombre
    when new.va then v_apodo || ' va a ' || v_j.nombre
    when tg_op = 'UPDATE' then v_apodo || ' ya no va a ' || v_j.nombre
    else v_apodo || ' no va a ' || v_j.nombre
  end;

  insert into notificaciones (perfil_id, juntada_id, tipo, titulo, cuerpo, url)
  select p.id, new.juntada_id, 'voto', v_titulo,
         case when new.va then 'Dijo que llega a las ' || hora_ba(new.hora_prometida) || '.'
              else 'Tocá para ver quiénes van.' end,
         '/juntada/' || new.juntada_id
  from perfiles p
  where p.activo and p.id <> new.perfil_id;
  return new;
end $$;

create trigger confirmaciones_notificar
  after insert or update of va on public.confirmaciones
  for each row execute function public.notificar_voto();
