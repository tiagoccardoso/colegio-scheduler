-- Tabela temporária para solicitações públicas de matrícula vindas do site.
-- Este patch já contempla os campos novos do formulário, incluindo endereço,
-- idade calculada e regra de maioridade (responsável opcional para 18+).

create table if not exists public.public_enrollment_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  school_name text null,
  student_name text not null,
  student_birth_date date not null,
  student_cpf text null,
  student_email text null,
  student_phone text null,
  student_zip_code text null,
  student_address_line1 text null,
  student_address_number text null,
  student_address_line2 text null,
  student_neighborhood text null,
  student_city text null,
  student_state text null,
  student_age integer null,
  is_adult_student boolean null,
  guardian_name text null,
  guardian_email text null,
  guardian_phone text null,
  desired_grade text not null,
  shift_preference text null,
  previous_school text null,
  notes text null,
  decision_notes text null,
  status text not null default 'PENDENTE',
  source text not null default 'SITE_PUBLICO',
  payload jsonb not null default '{}'::jsonb,
  approved_by uuid null references public.profiles(user_id) on delete set null,
  approved_at timestamptz null,
  converted_student_id uuid null references public.students(id) on delete set null,
  converted_enrollment_id uuid null references public.student_enrollments(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade para bancos que já têm a tabela criada com estrutura antiga.
alter table if exists public.public_enrollment_submissions
  add column if not exists student_zip_code text null,
  add column if not exists student_address_line1 text null,
  add column if not exists student_address_number text null,
  add column if not exists student_address_line2 text null,
  add column if not exists student_neighborhood text null,
  add column if not exists student_city text null,
  add column if not exists student_state text null,
  add column if not exists student_age integer null,
  add column if not exists is_adult_student boolean null,
  add column if not exists decision_notes text null,
  add column if not exists approved_by uuid null,
  add column if not exists approved_at timestamptz null,
  add column if not exists converted_student_id uuid null,
  add column if not exists converted_enrollment_id uuid null,
  add column if not exists submitted_at timestamptz null,
  add column if not exists created_at timestamptz null,
  add column if not exists updated_at timestamptz null;

-- Responsável passa a ser opcional quando o estudante é maior de 18 anos.
alter table if exists public.public_enrollment_submissions
  alter column guardian_name drop not null,
  alter column guardian_email drop not null,
  alter column guardian_phone drop not null;

-- Garante defaults importantes mesmo em bases antigas.
alter table if exists public.public_enrollment_submissions
  alter column status set default 'PENDENTE',
  alter column source set default 'SITE_PUBLICO',
  alter column payload set default '{}'::jsonb,
  alter column submitted_at set default now(),
  alter column created_at set default now(),
  alter column updated_at set default now();

create index if not exists public_enrollment_submissions_school_idx
  on public.public_enrollment_submissions (school_id, status, submitted_at desc);

create or replace function public.touch_updated_at_public_enrollment_submissions()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_public_enrollment_submissions_touch_updated_at on public.public_enrollment_submissions;
create trigger trg_public_enrollment_submissions_touch_updated_at
before update on public.public_enrollment_submissions
for each row execute function public.touch_updated_at_public_enrollment_submissions();

alter table public.public_enrollment_submissions enable row level security;

drop policy if exists staff_select on public.public_enrollment_submissions;
drop policy if exists staff_insert on public.public_enrollment_submissions;
drop policy if exists staff_update on public.public_enrollment_submissions;
drop policy if exists staff_delete on public.public_enrollment_submissions;

create policy staff_select on public.public_enrollment_submissions
for select to authenticated
using (public.is_staff_active_in_school(public_enrollment_submissions.school_id));

create policy staff_insert on public.public_enrollment_submissions
for insert to authenticated
with check (public.is_staff_active_in_school(public_enrollment_submissions.school_id));

create policy staff_update on public.public_enrollment_submissions
for update to authenticated
using (public.is_staff_active_in_school(public_enrollment_submissions.school_id))
with check (public.is_staff_active_in_school(public_enrollment_submissions.school_id));

create policy staff_delete on public.public_enrollment_submissions
for delete to authenticated
using (public.is_staff_active_in_school(public_enrollment_submissions.school_id));

grant select, insert, update, delete on public.public_enrollment_submissions to authenticated;
