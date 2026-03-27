-- Campo de CNPJ da escola para uso no painel do diretor.
-- Rodar no SQL Editor do Supabase.

alter table if exists public.schools
  add column if not exists cnpj text;

comment on column public.schools.cnpj is 'CNPJ institucional da escola.';
