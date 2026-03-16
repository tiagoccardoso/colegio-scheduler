-- Novo Ensino Médio — Fase 6
-- Cadastro completo do estudante, responsáveis e anexos de documentos para efetivação da matrícula.
-- Rode após os patches anteriores do NEM.

alter table public.students add column if not exists cpf text null;
alter table public.students add column if not exists rg text null;
alter table public.students add column if not exists rg_issuer text null;
alter table public.students add column if not exists rg_state text null;
alter table public.students add column if not exists birth_certificate_number text null;
alter table public.students add column if not exists nationality text null;
alter table public.students add column if not exists naturalness_city text null;
alter table public.students add column if not exists naturalness_state text null;
alter table public.students add column if not exists sex text null;
alter table public.students add column if not exists gender_identity text null;
alter table public.students add column if not exists race_color text null;
alter table public.students add column if not exists email text null;
alter table public.students add column if not exists phone text null;
alter table public.students add column if not exists mobile_phone text null;
alter table public.students add column if not exists zip_code text null;
alter table public.students add column if not exists street text null;
alter table public.students add column if not exists street_number text null;
alter table public.students add column if not exists address_complement text null;
alter table public.students add column if not exists neighborhood text null;
alter table public.students add column if not exists city text null;
alter table public.students add column if not exists state_code text null;
alter table public.students add column if not exists mother_name text null;
alter table public.students add column if not exists father_name text null;
alter table public.students add column if not exists nis_number text null;
alter table public.students add column if not exists sus_card_number text null;
alter table public.students add column if not exists blood_type text null;
alter table public.students add column if not exists allergy_notes text null;
alter table public.students add column if not exists health_notes text null;
alter table public.students add column if not exists medication_notes text null;
alter table public.students add column if not exists has_disability boolean not null default false;
alter table public.students add column if not exists disability_details text null;
alter table public.students add column if not exists has_aee boolean not null default false;
alter table public.students add column if not exists uses_school_transport boolean not null default false;
alter table public.students add column if not exists social_program_notes text null;
alter table public.students add column if not exists school_origin_name text null;
alter table public.students add column if not exists school_origin_network text null;
alter table public.students add column if not exists school_origin_city text null;
alter table public.students add column if not exists school_origin_state text null;
alter table public.students add column if not exists previous_school_year integer null;
alter table public.students add column if not exists previous_grade text null;
alter table public.students add column if not exists transfer_type text null;
alter table public.students add column if not exists transfer_date date null;

alter table public.student_enrollments add column if not exists enrollment_date date null;

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_type text null,
  full_name text not null,
  relationship text null,
  cpf text null,
  rg text null,
  phone text null,
  mobile_phone text null,
  email text null,
  profession text null,
  is_legal_guardian boolean not null default false,
  is_financial_guardian boolean not null default false,
  lives_with_student boolean not null default false,
  zip_code text null,
  street text null,
  street_number text null,
  address_complement text null,
  neighborhood text null,
  city text null,
  state_code text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_guardians_school_idx on public.student_guardians (school_id, student_id, created_at desc);

create table if not exists public.student_document_files (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  document_type text not null,
  document_name text null,
  storage_path text not null,
  mime_type text null,
  file_size_bytes bigint null,
  issued_at date null,
  expires_at date null,
  required_on_enrollment boolean not null default false,
  notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists student_document_files_school_idx on public.student_document_files (school_id, student_id, created_at desc);

-- Trigger de updated_at
create or replace function public.touch_updated_at_students_phase6()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_student_guardians_touch_updated_at on public.student_guardians;
create trigger trg_student_guardians_touch_updated_at
before update on public.student_guardians
for each row execute function public.touch_updated_at_students_phase6();

-- RLS
DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['student_guardians', 'student_document_files']
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

-- Bucket privado para documentos do estudante
insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do update set public = excluded.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff read student documents'
  ) THEN
    CREATE POLICY "Staff read student documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'student-documents'
      AND split_part(name, '/', 1) = 'schools'
      AND public.is_staff_active_in_school((split_part(name, '/', 2))::uuid)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff insert student documents'
  ) THEN
    CREATE POLICY "Staff insert student documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'student-documents'
      AND split_part(name, '/', 1) = 'schools'
      AND public.is_staff_active_in_school((split_part(name, '/', 2))::uuid)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff update student documents'
  ) THEN
    CREATE POLICY "Staff update student documents"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'student-documents'
      AND split_part(name, '/', 1) = 'schools'
      AND public.is_staff_active_in_school((split_part(name, '/', 2))::uuid)
    )
    WITH CHECK (
      bucket_id = 'student-documents'
      AND split_part(name, '/', 1) = 'schools'
      AND public.is_staff_active_in_school((split_part(name, '/', 2))::uuid)
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Staff delete student documents'
  ) THEN
    CREATE POLICY "Staff delete student documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'student-documents'
      AND split_part(name, '/', 1) = 'schools'
      AND public.is_staff_active_in_school((split_part(name, '/', 2))::uuid)
    );
  END IF;
END $$;
