-- Tareas programadas y bucket de fotos (no corre en el entorno de pruebas)
select cron.schedule('recordar-llegadas', '*/5 * * * *', $$select public.recordar_llegadas()$$);
-- 31/12 a las 20:00 de Buenos Aires (23:00 UTC)
select cron.schedule('avisar-wrapped', '0 23 31 12 *', $$select public.avisar_wrapped()$$);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos_ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
create policy "fotos_subir_archivo" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and owner = auth.uid());
create policy "fotos_borrar_archivo" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (owner = auth.uid() or public.es_admin()));
