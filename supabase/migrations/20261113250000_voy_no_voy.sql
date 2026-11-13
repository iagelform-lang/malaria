-- Respuesta a cada juntada: Voy (con hora) / No voy
alter table public.confirmaciones add column va boolean not null default true;
alter table public.confirmaciones alter column hora_prometida drop not null;
alter table public.confirmaciones
  add constraint voy_con_hora check ((va and hora_prometida is not null) or (not va and hora_prometida is null));

drop policy "confirmaciones_crear_propia"  on public.confirmaciones;
drop policy "confirmaciones_editar_propia" on public.confirmaciones;
drop policy "confirmaciones_borrar_propia" on public.confirmaciones;

-- Se responde mientras la juntada está abierta. Si dijo "voy", la hora tiene que ser futura.
-- Una vez pasada la hora que dijo, ya no puede cambiar (ni pasarse a "no voy" para no quedar tarde).
create policy "confirmaciones_crear_propia" on public.confirmaciones
  for insert to authenticated
  with check (perfil_id = auth.uid()
              and public.juntada_abierta(juntada_id)
              and (not va or hora_prometida > now()));
create policy "confirmaciones_editar_propia" on public.confirmaciones
  for update to authenticated
  using (perfil_id = auth.uid() and (hora_prometida is null or hora_prometida > now()))
  with check (perfil_id = auth.uid()
              and public.juntada_abierta(juntada_id)
              and (not va or hora_prometida > now()));
create policy "confirmaciones_borrar_propia" on public.confirmaciones
  for delete to authenticated
  using (perfil_id = auth.uid() and (hora_prometida is null or hora_prometida > now()));

-- Estadísticas: "plantones" son solo los que dijeron que iban
create or replace view public.v_estadisticas with (security_invoker = true) as
with por_juntada as (
  select a.perfil_id,
         a.juntada_id,
         min(a.entrada) as primera_entrada,
         max(a.salida)       filter (where a.origen_salida in ('qr','manual','auto_fin')) as ultima_salida,
         sum(a.duracion_min) filter (where a.origen_salida in ('qr','manual','auto_fin')) as minutos,
         min(a.entrada) <= coalesce(c.hora_prometida, j.inicio_programado)
                           + make_interval(mins => j.tolerancia_min)                     as puntual,
         (c.hora_prometida is not null)                                                  as habia_dicho_hora
  from asistencias a
  join juntadas j on j.id = a.juntada_id
  left join confirmaciones c on c.juntada_id = a.juntada_id and c.perfil_id = a.perfil_id and c.va
  where j.estado = 'finalizada'
  group by a.perfil_id, a.juntada_id, j.inicio_programado, j.tolerancia_min, c.hora_prometida
),
primeros as (
  select distinct on (juntada_id) juntada_id, perfil_id
  from por_juntada
  order by juntada_id, primera_entrada
),
ultimos as (
  select distinct on (juntada_id) juntada_id, perfil_id
  from por_juntada
  where ultima_salida is not null
  order by juntada_id, ultima_salida desc
),
plantones as (
  select c.perfil_id, count(*) as veces_planto
  from confirmaciones c
  join juntadas j on j.id = c.juntada_id and j.estado = 'finalizada'
  where c.va
    and not exists (select 1 from asistencias a
                    where a.juntada_id = c.juntada_id and a.perfil_id = c.perfil_id)
  group by c.perfil_id
),
posibles as (
  select p.id as perfil_id, count(j.id) as juntadas_posibles
  from perfiles p
  left join juntadas j
    on j.estado = 'finalizada'
   and (j.inicio_programado >= p.creado_en
        or exists (select 1 from asistencias a where a.juntada_id = j.id and a.perfil_id = p.id))
  group by p.id
)
select p.id    as perfil_id,
       p.apodo,
       count(pj.juntada_id)                                                    as juntadas_asistidas,
       po.juntadas_posibles,
       round(100.0 * count(pj.juntada_id) / nullif(po.juntadas_posibles, 0), 1) as pct_asistencia,
       round(coalesce(sum(pj.minutos), 0) / 60.0, 1)                           as horas_totales,
       round(avg(pj.minutos))                                                  as promedio_min_por_juntada,
       round(100.0 * count(*) filter (where pj.puntual)
             / nullif(count(pj.juntada_id), 0), 1)                             as pct_puntualidad,
       count(*) filter (where pj.habia_dicho_hora)                             as veces_dijo_hora,
       (select count(*) from primeros pr where pr.perfil_id = p.id)            as veces_primero,
       (select count(*) from ultimos  u  where u.perfil_id  = p.id)            as veces_ultimo,
       coalesce(pl.veces_planto, 0)                                            as veces_planto,
       (po.juntadas_posibles >= 3)                                             as elegible_fantasma
from perfiles p
join posibles po on po.perfil_id = p.id
left join por_juntada pj on pj.perfil_id = p.id
left join plantones pl on pl.perfil_id = p.id
where p.activo
group by p.id, p.apodo, po.juntadas_posibles, pl.veces_planto;
