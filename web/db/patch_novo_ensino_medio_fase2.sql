-- Novo Ensino Médio — Fase 2
-- Trajetória estudantil, acompanhamento pedagógico e permanência.
-- Rode este patch após o patch estrutural da Fase 1.

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  registration_number text null,
  full_name text not null,
  social_name text null,
  birth_date date null,
  status text not null default 'ATIVO',
  guardian_name text null,
  guardian_phone text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_school_idx on public.students (school_id, full_name);
create unique index if not exists students_school_registration_uniq
  on public.students (school_id, registration_number)
  where registration_number is not null and btrim(registration_number) <> '';

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  school_year integer not null,
  entry_cohort integer null,
  curriculum_version text null,
  offer_model text null,
  enrollment_status text not null default 'ATIVA',
  itinerary_axis text null,
  itinerary_name text null,
  elective_name text null,
  project_of_life_notes text null,
  risk_level text not null default 'BAIXO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_enrollments_school_idx on public.student_enrollments (school_id, school_year, enrollment_status);
create index if not exists student_enrollments_student_idx on public.student_enrollments (student_id, school_year desc);
create unique index if not exists student_enrollments_student_class_year_uniq
  on public.student_enrollments (student_id, class_id, school_year);

create table if not exists public.student_attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  reference_date date not null,
  status text not null,
  notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_attendance_school_idx on public.student_attendance_records (school_id, reference_date desc);
create index if not exists student_attendance_student_idx on public.student_attendance_records (student_id, reference_date desc);

create table if not exists public.student_assessment_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  assessment_title text not null,
  assessment_type text not null,
  reference_date date not null,
  score numeric(10,2) null,
  max_score numeric(10,2) null,
  result_status text null,
  evidence_url text null,
  notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_assessments_school_idx on public.student_assessment_records (school_id, reference_date desc);
create index if not exists student_assessments_student_idx on public.student_assessment_records (student_id, reference_date desc);

create table if not exists public.student_risk_alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete cascade,
  indicator_type text not null,
  severity text not null default 'MEDIA',
  status text not null default 'ABERTO',
  identified_at date not null default current_date,
  action_plan text null,
  responsible_name text null,
  notes text null,
  resolved_at timestamptz null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_risk_alerts_school_idx on public.student_risk_alerts (school_id, status, severity);
create index if not exists student_risk_alerts_student_idx on public.student_risk_alerts (student_id, identified_at desc);

create or replace function public.touch_updated_at_students()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_students_touch_updated_at on public.students;
create trigger trg_students_touch_updated_at
before update on public.students
for each row execute function public.touch_updated_at_students();

drop trigger if exists trg_student_enrollments_touch_updated_at on public.student_enrollments;
create trigger trg_student_enrollments_touch_updated_at
before update on public.student_enrollments
for each row execute function public.touch_updated_at_students();

drop trigger if exists trg_student_risk_alerts_touch_updated_at on public.student_risk_alerts;
create trigger trg_student_risk_alerts_touch_updated_at
before update on public.student_risk_alerts
for each row execute function public.touch_updated_at_students();

-- Normalizações leves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'students' AND constraint_name = 'students_status_check'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_status_check
      CHECK (status IN ('ATIVO', 'INATIVO', 'EGRESSO')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.students VALIDATE CONSTRAINT students_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_enrollments' AND constraint_name = 'student_enrollments_status_check'
  ) THEN
    ALTER TABLE public.student_enrollments
      ADD CONSTRAINT student_enrollments_status_check
      CHECK (enrollment_status IN ('ATIVA', 'PENDENTE', 'TRANCADA', 'TRANSFERIDA', 'CONCLUIDA', 'CANCELADA')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_enrollments VALIDATE CONSTRAINT student_enrollments_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_attendance_records' AND constraint_name = 'student_attendance_status_check'
  ) THEN
    ALTER TABLE public.student_attendance_records
      ADD CONSTRAINT student_attendance_status_check
      CHECK (status IN ('PRESENTE', 'FALTA', 'ATRASO', 'JUSTIFICADA')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_attendance_records VALIDATE CONSTRAINT student_attendance_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_risk_alerts' AND constraint_name = 'student_risk_alerts_status_check'
  ) THEN
    ALTER TABLE public.student_risk_alerts
      ADD CONSTRAINT student_risk_alerts_status_check
      CHECK (status IN ('ABERTO', 'EM_ACOMPANHAMENTO', 'RESOLVIDO')) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_risk_alerts VALIDATE CONSTRAINT student_risk_alerts_status_check;

-- RLS
DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'students',
    'student_enrollments',
    'student_attendance_records',
    'student_assessment_records',
    'student_risk_alerts'
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
