-- Novo Ensino Médio — Fase 3
-- Histórico escolar consolidado, trilhas técnicas e relatórios por coorte.
-- Rode este patch após as fases 1 e 2.

create table if not exists public.student_history_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete set null,
  school_year integer not null,
  series_year text null,
  curriculum_version text null,
  outcome_status text not null default 'EM_ANDAMENTO',
  fgb_hours_completed integer not null default 0,
  itinerary_hours_completed integer not null default 0,
  technical_hours_completed integer not null default 0,
  attendance_rate numeric(6,2) null,
  assessment_average numeric(6,2) null,
  final_notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists student_history_student_year_uniq
  on public.student_history_records (school_id, student_id, school_year);
create index if not exists student_history_school_idx
  on public.student_history_records (school_id, school_year desc, outcome_status);
create index if not exists student_history_enrollment_idx
  on public.student_history_records (enrollment_id);

create table if not exists public.student_professional_tracks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete set null,
  track_name text not null,
  partner_name text null,
  qualification_type text null,
  total_hours integer null,
  completed_hours integer not null default 0,
  certification_status text not null default 'EM_ANDAMENTO',
  certification_title text null,
  notes text null,
  started_at date null,
  concluded_at date null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_professional_tracks_school_idx
  on public.student_professional_tracks (school_id, certification_status, qualification_type);
create index if not exists student_professional_tracks_student_idx
  on public.student_professional_tracks (student_id, created_at desc);

create or replace function public.touch_updated_at_nem_phase3()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_student_history_touch_updated_at on public.student_history_records;
create trigger trg_student_history_touch_updated_at
before update on public.student_history_records
for each row execute function public.touch_updated_at_nem_phase3();

drop trigger if exists trg_student_professional_tracks_touch_updated_at on public.student_professional_tracks;
create trigger trg_student_professional_tracks_touch_updated_at
before update on public.student_professional_tracks
for each row execute function public.touch_updated_at_nem_phase3();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_history_records' AND constraint_name = 'student_history_outcome_check'
  ) THEN
    ALTER TABLE public.student_history_records
      ADD CONSTRAINT student_history_outcome_check
      CHECK (outcome_status IN ('EM_ANDAMENTO', 'APROVADO', 'REPROVADO', 'TRANSFERIDO', 'CONCLUIDO')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_history_records VALIDATE CONSTRAINT student_history_outcome_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_history_records' AND constraint_name = 'student_history_series_check'
  ) THEN
    ALTER TABLE public.student_history_records
      ADD CONSTRAINT student_history_series_check
      CHECK (series_year IS NULL OR series_year IN ('1A', '2A', '3A', '4A')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_history_records VALIDATE CONSTRAINT student_history_series_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_professional_tracks' AND constraint_name = 'student_professional_tracks_qualification_check'
  ) THEN
    ALTER TABLE public.student_professional_tracks
      ADD CONSTRAINT student_professional_tracks_qualification_check
      CHECK (qualification_type IS NULL OR qualification_type IN ('CURSO_TECNICO', 'QUALIFICACAO', 'FIC', 'CERTIFICACAO_INTERMEDIARIA')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_professional_tracks VALIDATE CONSTRAINT student_professional_tracks_qualification_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_professional_tracks' AND constraint_name = 'student_professional_tracks_status_check'
  ) THEN
    ALTER TABLE public.student_professional_tracks
      ADD CONSTRAINT student_professional_tracks_status_check
      CHECK (certification_status IN ('EM_ANDAMENTO', 'APTA_PARA_CERTIFICAR', 'CERTIFICADA', 'INTERROMPIDA')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_professional_tracks VALIDATE CONSTRAINT student_professional_tracks_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_history_records' AND constraint_name = 'student_history_hours_check'
  ) THEN
    ALTER TABLE public.student_history_records
      ADD CONSTRAINT student_history_hours_check
      CHECK (
        fgb_hours_completed >= 0
        AND itinerary_hours_completed >= 0
        AND technical_hours_completed >= 0
        AND (attendance_rate IS NULL OR (attendance_rate >= 0 AND attendance_rate <= 100))
        AND (assessment_average IS NULL OR (assessment_average >= 0 AND assessment_average <= 100))
      ) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_history_records VALIDATE CONSTRAINT student_history_hours_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_professional_tracks' AND constraint_name = 'student_professional_tracks_hours_check'
  ) THEN
    ALTER TABLE public.student_professional_tracks
      ADD CONSTRAINT student_professional_tracks_hours_check
      CHECK (
        completed_hours >= 0
        AND (total_hours IS NULL OR total_hours >= 0)
        AND (total_hours IS NULL OR completed_hours <= total_hours)
      ) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_professional_tracks VALIDATE CONSTRAINT student_professional_tracks_hours_check;

DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'student_history_records',
    'student_professional_tracks'
  ]
  LOOP
    EXECUTE format('alter table public.%I enable row level security', tbl);

    EXECUTE format('drop policy if exists staff_select on public.%I', tbl);
    EXECUTE format('drop policy if exists staff_insert on public.%I', tbl);
    EXECUTE format('drop policy if exists staff_update on public.%I', tbl);
    EXECUTE format('drop policy if exists staff_delete on public.%I', tbl);

    EXECUTE format(
      'create policy staff_select on public.%I for select to authenticated using (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    EXECUTE format(
      'create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    EXECUTE format(
      'create policy staff_update on public.%I for update to authenticated using (public.is_staff_active_in_school(%I.school_id)) with check (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl, tbl
    );

    EXECUTE format(
      'create policy staff_delete on public.%I for delete to authenticated using (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    EXECUTE format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  END LOOP;
END
$do$;
