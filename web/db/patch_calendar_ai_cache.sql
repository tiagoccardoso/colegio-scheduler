-- Patch: adiciona campos de cache nas fontes do calendário
-- Permite evitar chamadas repetidas à IA quando o conteúdo da fonte não mudou.

alter table if exists public.calendar_sources
  add column if not exists last_content_hash text null;

alter table if exists public.calendar_sources
  add column if not exists last_checked_at timestamptz null;

alter table if exists public.calendar_sources
  add column if not exists last_ai_at timestamptz null;

alter table if exists public.calendar_sources
  add column if not exists last_ai_model text null;

-- Índice leve para auditoria/diagnóstico
create index if not exists calendar_sources_school_checked_idx
  on public.calendar_sources (school_id, last_checked_at);
