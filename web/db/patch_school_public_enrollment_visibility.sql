-- Controle de visibilidade do colégio na lista pública de matrículas.
--
-- Objetivo:
-- permitir que o diretor decida, no Painel do Diretor,
-- se o colégio deve aparecer ou não na lista pública de escolas
-- disponíveis para solicitações de matrícula.

alter table if exists public.schools
  add column if not exists public_enrollment_visible boolean not null default true;

comment on column public.schools.public_enrollment_visible is
  'Quando true, o colégio pode aparecer na lista pública de escolas disponíveis para matrícula.';
