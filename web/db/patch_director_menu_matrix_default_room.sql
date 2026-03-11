-- Suporte às telas "Matriz Curricular" e "Sala Padrão"
-- Rode no Supabase SQL Editor se sua base ainda não tiver essas estruturas.

alter table if exists public.classes
  add column if not exists default_room_id uuid references public.rooms(id) on delete set null;

alter table if exists public.teachers
  add column if not exists default_room_id uuid references public.rooms(id) on delete set null;

create table if not exists public.class_subject_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  lessons_per_week integer not null,
  created_at timestamptz not null default now(),
  constraint class_subject_requirements_lessons_positive check (lessons_per_week > 0),
  constraint class_subject_requirements_unique unique (school_id, class_id, subject_id)
);

create index if not exists class_subject_requirements_school_idx
  on public.class_subject_requirements (school_id);

create index if not exists class_subject_requirements_class_idx
  on public.class_subject_requirements (class_id);
