-- Pré-matrícula inteligente
-- Cria intake de documentos para análise assistida e conversão em cadastro de estudante.

create table if not exists public.student_pre_enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  intake_name text not null,
  status text not null default 'RASCUNHO',
  notes text null,
  analysis_summary text null,
  analysis_warnings text[] not null default '{}',
  proposed_student jsonb not null default '{}'::jsonb,
  proposed_guardians jsonb not null default '[]'::jsonb,
  proposed_enrollment jsonb not null default '{}'::jsonb,
  converted_student_id uuid null references public.students(id) on delete set null,
  converted_enrollment_id uuid null references public.student_enrollments(id) on delete set null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  updated_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_pre_enrollments_school_idx
  on public.student_pre_enrollments (school_id, status, created_at desc);

create table if not exists public.student_pre_enrollment_files (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  pre_enrollment_id uuid not null references public.student_pre_enrollments(id) on delete cascade,
  document_type text null,
  document_name text null,
  storage_path text not null,
  mime_type text null,
  file_size_bytes bigint null,
  extracted_text text null,
  analysis_status text not null default 'PENDENTE',
  analysis_summary text null,
  ai_payload jsonb not null default '{}'::jsonb,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_pre_enrollment_files_school_idx
  on public.student_pre_enrollment_files (school_id, pre_enrollment_id, created_at desc);

create or replace function public.touch_updated_at_pre_enrollment()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_student_pre_enrollments_touch_updated_at on public.student_pre_enrollments;
create trigger trg_student_pre_enrollments_touch_updated_at
before update on public.student_pre_enrollments
for each row execute function public.touch_updated_at_pre_enrollment();

drop trigger if exists trg_student_pre_enrollment_files_touch_updated_at on public.student_pre_enrollment_files;
create trigger trg_student_pre_enrollment_files_touch_updated_at
before update on public.student_pre_enrollment_files
for each row execute function public.touch_updated_at_pre_enrollment();

DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['student_pre_enrollments', 'student_pre_enrollment_files']
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
