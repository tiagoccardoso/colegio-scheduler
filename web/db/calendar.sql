-- Calendário do Diretor
--
-- Objetivo: armazenar fontes (sites/PDFs) e eventos cacheados para alta performance.
-- Aplicação lê somente do banco; atualização é feita via /api/calendar/refresh.

-- 1) Fontes por escola
create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  url text not null,
  type text not null default 'site',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_sources_school_id_idx on public.calendar_sources (school_id);

-- 2) Eventos cacheados (alto volume)
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  source_id uuid null references public.calendar_sources(id) on delete set null,
  source_name text null,
  source_url text null,
  category text not null default 'Outros',
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz null,
  hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deduplicação / upsert
create unique index if not exists calendar_events_school_hash_uniq on public.calendar_events (school_id, hash);

create index if not exists calendar_events_school_start_idx on public.calendar_events (school_id, start_at);
create index if not exists calendar_events_source_idx on public.calendar_events (school_id, source_id);

-- 3) Preferências do diretor (municipio/NRE) — preparado para evolução
create table if not exists public.director_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  municipality text null,
  nre_slug text null,
  nre_url text null,
  updated_at timestamptz not null default now()
);

-- RLS: segue padrão do projeto (políticas existentes do colégio)
-- Se você já tem RLS por school_id, basta adicionar policies equivalentes aqui.
