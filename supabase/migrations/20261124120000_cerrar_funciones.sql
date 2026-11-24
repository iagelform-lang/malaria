-- Auditoría: funciones internas que cualquiera podía ejecutar (incluso sin estar logueado).
-- Las de avisos solo las corre el sistema; las de chequeo, solo usuarios logueados (las usan las reglas de acceso).

revoke execute on function public.resumir_votos(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.resumir_votos_pendientes() from public, anon, authenticated;

revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.juntada_abierta(uuid) from public, anon;
revoke execute on function public.puede_gestionar(uuid) from public, anon;
revoke execute on function public.es_participante(uuid) from public, anon;
revoke execute on function public.juntada_con_gastos(uuid) from public, anon;
revoke execute on function public.sondeo_abierto_mio(uuid) from public, anon;
revoke execute on function public.opcion_abierta(bigint) from public, anon;
revoke execute on function public.puede_cargar_partida(uuid) from public, anon;
revoke execute on function public.partida_mia(bigint) from public, anon;
revoke execute on function public.votos_para_mayoria() from public, anon;
revoke execute on function public.es_miembro_cuenta(uuid) from public, anon;
revoke execute on function public.gestiona_cuenta(uuid) from public, anon;

grant execute on function public.es_admin() to authenticated;
grant execute on function public.juntada_abierta(uuid) to authenticated;
grant execute on function public.puede_gestionar(uuid) to authenticated;
grant execute on function public.es_participante(uuid) to authenticated;
grant execute on function public.juntada_con_gastos(uuid) to authenticated;
grant execute on function public.sondeo_abierto_mio(uuid) to authenticated;
grant execute on function public.opcion_abierta(bigint) to authenticated;
grant execute on function public.puede_cargar_partida(uuid) to authenticated;
grant execute on function public.partida_mia(bigint) to authenticated;
grant execute on function public.votos_para_mayoria() to authenticated;
grant execute on function public.es_miembro_cuenta(uuid) to authenticated;
grant execute on function public.gestiona_cuenta(uuid) to authenticated;
