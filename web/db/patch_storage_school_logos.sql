-- Cria (ou garante) o bucket usado para logomarcas
-- O código do projeto usa: const BUCKET = "school-logos"

-- 1) Bucket (Storage)
insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do update set public = excluded.public;

-- 2) RLS em storage.objects (normalmente já vem habilitado)
alter table storage.objects enable row level security;

-- 3) Policies
-- Leitura pública (necessária se você usa URL pública / getPublicUrl)
drop policy if exists "Public read school logos" on storage.objects;
create policy "Public read school logos"
on storage.objects for select
to public
using (bucket_id = 'school-logos');

-- Upload apenas para o diretor da escola (baseado em profiles.school_id)
-- Caminho esperado do arquivo: schools/<school_id>/logo

drop policy if exists "Directors can upload school logos" on storage.objects;
create policy "Directors can upload school logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'school-logos'
  and split_part(name, '/', 1) = 'schools'
  and split_part(name, '/', 3) = 'logo'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id::text = split_part(storage.objects.name, '/', 2)
  )
);

-- Atualização (importante porque upload com upsert=true pode virar UPDATE)
drop policy if exists "Directors can update school logos" on storage.objects;
create policy "Directors can update school logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'school-logos'
  and split_part(name, '/', 1) = 'schools'
  and split_part(name, '/', 3) = 'logo'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id::text = split_part(storage.objects.name, '/', 2)
  )
)
with check (
  bucket_id = 'school-logos'
  and split_part(name, '/', 1) = 'schools'
  and split_part(name, '/', 3) = 'logo'
  and exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id::text = split_part(storage.objects.name, '/', 2)
  )
);

-- (Opcional) Remoção do logo pela própria escola
-- drop policy if exists "Directors can delete school logos" on storage.objects;
-- create policy "Directors can delete school logos"
-- on storage.objects for delete
-- to authenticated
-- using (
--   bucket_id = 'school-logos'
--   and split_part(name, '/', 1) = 'schools'
--   and split_part(name, '/', 3) = 'logo'
--   and exists (
--     select 1
--     from public.profiles p
--     where p.user_id = auth.uid()
--       and p.school_id::text = split_part(storage.objects.name, '/', 2)
--   )
-- );
