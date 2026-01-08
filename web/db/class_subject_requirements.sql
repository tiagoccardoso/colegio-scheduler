-- Colégio Scheduler — Matriz curricular por turma
-- Define quantas aulas/semana cada disciplina deve ter em cada turma.
-- Execute este script no Supabase (SQL Editor) no schema public.

create table if not exists public.class_subject_requirements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  lessons_per_week integer not null,

  created_at timestamp with time zone not null default now(),

  constraint class_subject_requirements_lessons_positive check (lessons_per_week > 0),
  constraint class_subject_requirements_unique unique (school_id, class_id, subject_id),

  constraint class_subject_requirements_class_fk
    foreign key (class_id) references public.classes(id) on delete cascade,
  constraint class_subject_requirements_subject_fk
    foreign key (subject_id) references public.subjects(id) on delete cascade
);

create index if not exists class_subject_requirements_school_idx
  on public.class_subject_requirements (school_id);

create index if not exists class_subject_requirements_class_idx
  on public.class_subject_requirements (class_id);
