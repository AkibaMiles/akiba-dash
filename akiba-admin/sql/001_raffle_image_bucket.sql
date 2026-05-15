-- Public Supabase Storage bucket for admin-uploaded raffle card images.
-- The admin API uploads with the service role key; users only need public read.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'raffle-images',
  'raffle-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read raffle images'
  ) then
    create policy "Public read raffle images"
      on storage.objects
      for select
      to public
      using (bucket_id = 'raffle-images');
  end if;
end
$$;
