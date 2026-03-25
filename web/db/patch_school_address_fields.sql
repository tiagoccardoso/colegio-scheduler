-- Endereço institucional completo da escola no painel do diretor.
-- Rodar no SQL Editor do Supabase.

alter table if exists public.schools
  add column if not exists zip_code text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text,
  add column if not exists city text,
  add column if not exists state_code text;

comment on column public.schools.zip_code is 'CEP da escola.';
comment on column public.schools.address_street is 'Logradouro da escola.';
comment on column public.schools.address_number is 'Número do endereço da escola.';
comment on column public.schools.address_complement is 'Complemento do endereço da escola.';
comment on column public.schools.address_neighborhood is 'Bairro da escola.';
comment on column public.schools.city is 'Cidade da escola.';
comment on column public.schools.state_code is 'UF da escola, em formato de duas letras.';
