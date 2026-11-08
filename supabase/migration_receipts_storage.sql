-- ================================================
-- Storage bucket for receipt photos ("Bukti Transaksi")
-- ================================================
-- Private bucket (public = false) — every read goes through a signed
-- URL (see src/lib/media/photoUpload.ts's getPhotoUrl()), never a
-- permanent public link, since these are personal financial documents.
--
-- Objects are stored as "{user_id}/{transaction_id}.webp" (or .jpg as
-- a fallback — see compressImage.ts). The RLS policies below use the
-- first path segment as the owner check, same pattern as the row-level
-- policies on public.transactions etc.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_select_own" on storage.objects;
drop policy if exists "receipts_insert_own" on storage.objects;
drop policy if exists "receipts_update_own" on storage.objects;
drop policy if exists "receipts_delete_own" on storage.objects;

create policy "receipts_select_own" on storage.objects
  for select using (
    bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_update_own" on storage.objects
  for update using (
    bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "receipts_delete_own" on storage.objects
  for delete using (
    bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]
  );
