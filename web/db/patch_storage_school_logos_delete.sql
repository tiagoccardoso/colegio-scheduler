-- PATCH: Permitir DELETE da logomarca pelo diretor (Supabase Storage)
--
-- Rode no Supabase SQL Editor como role "postgres" (ou "supabase_admin").
--
-- O app faz upload no bucket "school-logos" em:
--   schools/<school_id>/logo
-- (ou, em instalações antigas, pode haver objetos em:
--   schools/<school_id>/logo/<arquivo>
--  - ambos passam pelo mesmo critério: split_part(name,'/',3) = 'logo')

-- Observação: RLS normalmente já vem habilitado em `storage.objects`.
-- Evitamos alterar RLS aqui para reduzir erros de permissão.

-- Substitui/Cria a policy de DELETE
DROP POLICY IF EXISTS "Directors can delete school logos" ON storage.objects;

CREATE POLICY "Directors can delete school logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'school-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'director'
      -- Permite apagar qualquer coisa sob:
      -- schools/<school_id>/logo   (logo)
      -- schools/<school_id>/logo.* (logo.png, logo.jpg...)
      -- schools/<school_id>/logo/<arquivo> (instalações antigas)
      AND storage.objects.name LIKE ('schools/' || p.school_id::text || '/logo%')
  )
);
