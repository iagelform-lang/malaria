-- Cuenta regresiva: un aviso cada vez que cambia la foto (cada 2 horas, de 9 a 23 hora de Buenos Aires),
-- con la misma foto que muestra la app en ese momento (mismo orden que lib/cuentaRegresiva.ts).

create or replace function public.avisar_cuenta_regresiva(p_ahora timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  -- mismo orden que FOTOS_UNICAS en lib/cuentaRegresiva.ts
  v_fotos  int[] := array[39, 82, 57, 24, 53, 32, 102, 91, 86, 78, 52, 33, 21, 49, 54, 10, 88, 11, 77, 93, 51, 94, 3, 63, 56, 26, 90, 17, 67, 59, 42, 15, 92, 69, 58, 74, 48, 44, 68, 7, 41, 75, 79, 71, 37, 66, 98, 18, 50, 60, 40, 31, 19, 95, 34, 84, 47, 1, 36, 87, 45, 16, 38, 29, 61, 46, 101, 4, 35, 97, 5, 8, 9, 72, 2, 22, 89, 55, 81, 6, 73, 12, 20, 43, 100, 14, 96, 83, 85, 65, 99, 27, 28, 80, 70, 103, 64, 76, 62];
  v_primer int := 32;  -- PRIMER_DIA
  v_local  timestamp := p_ahora at time zone 'America/Argentina/Buenos_Aires';
  v_hoy    date := v_local::date;
  v_hora   int := extract(hour from v_local)::int;
  v_f      fechas_especiales%rowtype;
  v_inicio date;
  v_faltan int;
  v_turno  int;
  v_i      int;
  v_n      int;
begin
  if v_hora < 9 then return 0; end if;  -- de noche no hay foto
  select * into v_f from fechas_especiales where nombre ilike '%malariaso%' order by id limit 1;
  if not found then return 0; end if;
  v_inicio := make_date(extract(year from v_hoy)::int, v_f.mes, v_f.dia);
  if v_inicio + (greatest(v_f.duracion_dias, 1) - 1) < v_hoy then
    v_inicio := make_date(extract(year from v_hoy)::int + 1, v_f.mes, v_f.dia);
  end if;
  v_faltan := v_inicio - v_hoy;
  if v_faltan < 0 or v_faltan > v_primer then return 0; end if;
  v_turno := (v_hora - 9) / 2;
  -- un solo aviso por turno de foto
  if exists (select 1 from notificaciones where tipo = 'cuenta'
             and creado_en >= ((v_hoy + make_interval(hours => 9 + v_turno * 2)) at time zone 'America/Argentina/Buenos_Aires')) then
    return 0;
  end if;
  v_i := ((((v_primer - v_faltan) * 8 + v_turno) % array_length(v_fotos, 1)) + array_length(v_fotos, 1)) % array_length(v_fotos, 1);
  insert into notificaciones (perfil_id, tipo, titulo, cuerpo, url, imagen)
  select p.id, 'cuenta',
         case when v_faltan = 0 then '📸 Foto nueva · ¡Hoy arranca ' || v_f.nombre || '!'
              when v_faltan = 1 then '📸 Foto nueva · Falta 1 día para ' || v_f.nombre
              else '📸 Foto nueva · Faltan ' || v_faltan || ' días para ' || v_f.nombre end,
         'Entrá a verla.',
         '/',
         '/cr-db6d31288d68/' || lpad(v_fotos[v_i + 1]::text, 2, '0') || '.jpg'
  from perfiles p
  where p.activo;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
drop function if exists public.avisar_cuenta_regresiva(int, date);
revoke execute on function public.avisar_cuenta_regresiva(timestamptz) from public, anon, authenticated;

