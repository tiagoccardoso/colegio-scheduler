-- Novo Ensino Médio — Fase 4
-- Emissão formal de documentos, layout institucional e rastreio de declarações/históricos.
-- Rode este patch após as fases 1, 2 e 3.

create table if not exists public.school_document_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  institution_name_override text null,
  network_name text null,
  city text null,
  state_code text null,
  ordinance_reference text null,
  header_text text null,
  footer_text text null,
  principal_name text null,
  principal_role_label text not null default 'Direção',
  secretary_name text null,
  secretary_role_label text not null default 'Secretaria Escolar',
  default_history_observation text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_document_issues (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete set null,
  history_record_id uuid null references public.student_history_records(id) on delete set null,
  issue_type text not null,
  issue_number text null,
  issued_at date not null default current_date,
  requested_by text null,
  signatory_snapshot jsonb not null default '{}'::jsonb,
  document_payload jsonb not null default '{}'::jsonb,
  notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_document_settings_city_idx
  on public.school_document_settings (city, state_code);
create index if not exists student_document_issues_school_idx
  on public.student_document_issues (school_id, issued_at desc, issue_type);
create index if not exists student_document_issues_student_idx
  on public.student_document_issues (student_id, created_at desc);
create unique index if not exists student_document_issues_number_uniq
  on public.student_document_issues (school_id, issue_number)
  where issue_number is not null and btrim(issue_number) <> '';

create or replace function public.touch_updated_at_nem_phase4()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_school_document_settings_touch_updated_at on public.school_document_settings;
create trigger trg_school_document_settings_touch_updated_at
before update on public.school_document_settings
for each row execute function public.touch_updated_at_nem_phase4();

drop trigger if exists trg_student_document_issues_touch_updated_at on public.student_document_issues;
create trigger trg_student_document_issues_touch_updated_at
before update on public.student_document_issues
for each row execute function public.touch_updated_at_nem_phase4();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'school_document_settings' AND constraint_name = 'school_document_state_code_check'
  ) THEN
    ALTER TABLE public.school_document_settings
      ADD CONSTRAINT school_document_state_code_check
      CHECK (state_code IS NULL OR char_length(btrim(state_code)) = 2) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.school_document_settings VALIDATE CONSTRAINT school_document_state_code_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'student_document_issues' AND constraint_name = 'student_document_issues_type_check'
  ) THEN
    ALTER TABLE public.student_document_issues
      ADD CONSTRAINT student_document_issues_type_check
      CHECK (issue_type IN (
        'DECLARACAO_MATRICULA',
        'DECLARACAO_FREQUENCIA',
        'BOLETIM_SINTETICO',
        'HISTORICO_ESCOLAR_NEM',
        'CERTIFICADO_TRILHA_TECNICA',
        'DECLARACAO_PROJETO_VIDA'
      )) NOT VALID;
  END IF;
END
$$;
ALTER TABLE public.student_document_issues VALIDATE CONSTRAINT student_document_issues_type_check;

DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'school_document_settings',
    'student_document_issues'
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
