-- PATCH v2: bucket + policies para logomarca do colégio
--
-- IMPORTANTE:
-- - Rode este script como role "postgres" no Supabase (SQL Editor -> Run as -> postgres).
-- - O app faz upload em: bucket "school-logos" / path "schools/<school_id>/logo"

-- 1) Garantir bucket
insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do update set public = excluded.public;

-- 2) Policies em storage.objects
-- Observação: storage.objects já vem com RLS habilitado no Supabase; não mexemos nisso aqui.

-- Leitura pública (necessária para o endpoint /object/public/...)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Public read school logos'
  ) then
    create policy "Public read school logos"
    on storage.objects
    for select
    to public
    using (bucket_id = 'school-logos');
  end if;
end $$;

-- Inserção: apenas diretor da escola correspondente pode subir o logo
-- Caminho esperado: schools/<school_id>/logo

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Directors can upload school logos'
  ) then
    create policy "Directors can upload school logos"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'school-logos'
      and split_part(name, '/', 1) = 'schools'
      and split_part(name, '/', 3) = 'logo'
      and exists (
        select 1
        from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'director'
          and p.school_id::text = split_part(storage.objects.name, '/', 2)
      )
    );
  end if;
end $$;

-- Update: necessário porque o upload usa upsert: true e pode virar UPDATE

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'Directors can update school logos'
  ) then
    create policy "Directors can update school logos"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'school-logos'
      and split_part(name, '/', 1) = 'schools'
      and split_part(name, '/', 3) = 'logo'
      and exists (
        select 1
        from public.profiles p
        where p.user_id = auth.uid()
          and p.role = 'director'
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
          and p.role = 'director'
          and p.school_id::text = split_part(storage.objects.name, '/', 2)
      )
    );
  end if;
end $$;

-- (Opcional) Delete do logo pelo diretor
-- do $$
-- begin
--   if not exists (
--     select 1
--     from pg_policies
--     where schemaname = 'storage'
--       and tablename  = 'objects'
--       and policyname = 'Directors can delete school logos'
--   ) then
--     create policy "Directors can delete school logos"
--     on storage.objects
--     for delete
--     to authenticated
--     using (
--       bucket_id = 'school-logos'
--       and split_part(name, '/', 1) = 'schools'
--       and split_part(name, '/', 3) = 'logo'
--       and exists (
--         select 1
--         from public.profiles p
--         where p.user_id = auth.uid()
--           and p.role = 'director'
--           and p.school_id::text = split_part(storage.objects.name, '/', 2)
--       )
--     );
--   end if;
-- end $$;
