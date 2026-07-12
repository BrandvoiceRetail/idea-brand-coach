-- Private 'workbooks' Storage bucket for gold-workbook + messaging-perception .xlsx
-- exports (export_workbook / export_messaging_workbook MCP tools). Files live at
-- {uid}/{filename}; each user accesses ONLY their own folder; downloads use the
-- time-limited signed URLs minted by uploadWorkbook (createSignedUrl). Applied to
-- prod 2026-07-12 via the Supabase MCP; this file tracks it for fresh environments.
-- Idempotent: safe to re-run.
insert into storage.buckets (id, name, public)
values ('workbooks', 'workbooks', false)
on conflict (id) do nothing;

drop policy if exists "workbooks_owner_insert" on storage.objects;
drop policy if exists "workbooks_owner_select" on storage.objects;
drop policy if exists "workbooks_owner_update" on storage.objects;

create policy "workbooks_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'workbooks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workbooks_owner_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'workbooks' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "workbooks_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'workbooks' and (storage.foldername(name))[1] = auth.uid()::text);
