-- Novo Ensino Médio — Fase 8
-- Conformidade estrutural com a régua nacional vigente do Ensino Médio.
-- Patch idempotente para complementar fases anteriores.
-- Corrige:
-- 1) oferta formal de itinerários;
-- 2) escolha formal do estudante;
-- 3) validação de espanhol, presencialidade e Projeto de Vida transversal/componente;
-- 4) histórico detalhado por componente.
--
-- OBS:
-- Este patch assume que as fases anteriores já criaram:
-- public.schools, public.students, public.student_enrollments,
-- public.subjects, public.classes, public.school_curriculum_settings,
-- public.student_history_records, public.profiles
--
-- O erro anterior aconteceu porque a referência estava em public.student_histories,
-- mas no seu projeto a tabela correta é public.student_history_records.

begin;

-- =========================================================
-- 1) CAMPOS NOVOS EM TABELAS EXISTENTES
-- =========================================================

alter table if exists public.school_curriculum_settings
  add column if not exists project_of_life_mode text not null default 'TRANSVERSAL',
  add column if not exists require_portuguese_and_math_every_year boolean not null default true,
  add column if not exists require_spanish_offer boolean not null default false,
  add column if not exists require_itineraries_presential boolean not null default true;

alter table if exists public.subjects
  add column if not exists language_code text null,
  add column if not exists is_spanish_optative boolean not null default false;

alter table if exists public.classes
  add column if not exists itinerary_offer_id uuid null,
  add column if not exists is_presential boolean not null default true;

alter table if exists public.student_enrollments
  add column if not exists itinerary_offer_id uuid null,
  add column if not exists itinerary_selection_status text not null default 'PENDENTE';

-- =========================================================
-- 2) OFERTAS FORMAIS DE ITINERÁRIO
-- =========================================================

create table if not exists public.school_itinerary_offers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text null,
  name text not null,
  axis text not null,
  offer_model text not null default 'NEM_REGULAR',
  entry_cohort integer null,
  curriculum_version text null,
  total_hours integer null,
  is_presential boolean not null default true,
  active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists school_itinerary_offers_school_idx
  on public.school_itinerary_offers (school_id, active, entry_cohort, curriculum_version);

create unique index if not exists school_itinerary_offers_school_code_uniq
  on public.school_itinerary_offers (school_id, code)
  where code is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_itinerary_offer_id_fkey'
  ) then
    alter table public.classes
      add constraint classes_itinerary_offer_id_fkey
      foreign key (itinerary_offer_id)
      references public.school_itinerary_offers(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_enrollments_itinerary_offer_id_fkey'
  ) then
    alter table public.student_enrollments
      add constraint student_enrollments_itinerary_offer_id_fkey
      foreign key (itinerary_offer_id)
      references public.school_itinerary_offers(id)
      on delete set null;
  end if;
end
$$;

-- =========================================================
-- 3) ESCOLHA FORMAL DO ESTUDANTE
-- =========================================================

create table if not exists public.student_itinerary_selections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  enrollment_id uuid null references public.student_enrollments(id) on delete cascade,
  itinerary_offer_id uuid not null references public.school_itinerary_offers(id) on delete cascade,
  selection_status text not null default 'ESCOLHIDO',
  selected_at timestamptz not null default now(),
  changed_at timestamptz null,
  notes text null,
  created_by uuid null references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_itinerary_selections_school_idx
  on public.student_itinerary_selections (school_id, student_id, selected_at desc);

-- =========================================================
-- 4) ITENS DETALHADOS DO HISTÓRICO POR COMPONENTE
--    CORRIGIDO: history_id -> public.student_history_records(id)
-- =========================================================

create table if not exists public.student_history_subject_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  history_id uuid not null references public.student_history_records(id) on delete cascade,
  subject_id uuid null references public.subjects(id) on delete set null,
  series_year text null,
  school_year integer null,
  workload_hours numeric(10,1) null,
  final_average numeric(10,2) null,
  attendance_percent numeric(5,2) null,
  outcome text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_history_subject_items_history_idx
  on public.student_history_subject_items (school_id, history_id, school_year, series_year);

-- =========================================================
-- 5) FUNÇÃO DE updated_at
-- =========================================================

create or replace function public.touch_updated_at_nem_fase8()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_school_itinerary_offers_touch_updated_at on public.school_itinerary_offers;
create trigger trg_school_itinerary_offers_touch_updated_at
before update on public.school_itinerary_offers
for each row execute function public.touch_updated_at_nem_fase8();

drop trigger if exists trg_student_itinerary_selections_touch_updated_at on public.student_itinerary_selections;
create trigger trg_student_itinerary_selections_touch_updated_at
before update on public.student_itinerary_selections
for each row execute function public.touch_updated_at_nem_fase8();

drop trigger if exists trg_student_history_subject_items_touch_updated_at on public.student_history_subject_items;
create trigger trg_student_history_subject_items_touch_updated_at
before update on public.student_history_subject_items
for each row execute function public.touch_updated_at_nem_fase8();

-- =========================================================
-- 6) BACKFILL / NORMALIZAÇÃO
-- =========================================================

update public.school_curriculum_settings
set project_of_life_mode = coalesce(project_of_life_mode, 'TRANSVERSAL')
where project_of_life_mode is null;

update public.subjects
set language_code = 'ES'
where is_spanish_optative = true
  and language_code is null;

update public.classes
set is_presential = true
where is_presential is null;

update public.student_enrollments
set itinerary_selection_status = coalesce(nullif(itinerary_selection_status, ''), 'PENDENTE')
where itinerary_selection_status is null
   or itinerary_selection_status = '';

-- =========================================================
-- 7) CHECK CONSTRAINTS
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'school_curriculum_settings'
      and constraint_name = 'school_curriculum_settings_project_of_life_mode_check'
  ) then
    alter table public.school_curriculum_settings
      add constraint school_curriculum_settings_project_of_life_mode_check
      check (project_of_life_mode in ('TRANSVERSAL', 'COMPONENTE')) not valid;
  end if;
end
$$;

alter table public.school_curriculum_settings
  validate constraint school_curriculum_settings_project_of_life_mode_check;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'student_enrollments'
      and constraint_name = 'student_enrollments_itinerary_selection_status_check'
  ) then
    alter table public.student_enrollments
      add constraint student_enrollments_itinerary_selection_status_check
      check (itinerary_selection_status in ('PENDENTE', 'ESCOLHIDO', 'ALTERADO', 'CANCELADO')) not valid;
  end if;
end
$$;

alter table public.student_enrollments
  validate constraint student_enrollments_itinerary_selection_status_check;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'student_itinerary_selections'
      and constraint_name = 'student_itinerary_selections_status_check'
  ) then
    alter table public.student_itinerary_selections
      add constraint student_itinerary_selections_status_check
      check (selection_status in ('ESCOLHIDO', 'ALTERADO', 'CANCELADO')) not valid;
  end if;
end
$$;

alter table public.student_itinerary_selections
  validate constraint student_itinerary_selections_status_check;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'student_history_subject_items'
      and constraint_name = 'student_history_subject_items_series_check'
  ) then
    alter table public.student_history_subject_items
      add constraint student_history_subject_items_series_check
      check (series_year is null or series_year in ('1A', '2A', '3A', '4A')) not valid;
  end if;
end
$$;

alter table public.student_history_subject_items
  validate constraint student_history_subject_items_series_check;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'student_history_subject_items'
      and constraint_name = 'student_history_subject_items_numeric_check'
  ) then
    alter table public.student_history_subject_items
      add constraint student_history_subject_items_numeric_check
      check (
        (workload_hours is null or workload_hours >= 0)
        and (final_average is null or (final_average >= 0 and final_average <= 100))
        and (attendance_percent is null or (attendance_percent >= 0 and attendance_percent <= 100))
      ) not valid;
  end if;
end
$$;

alter table public.student_history_subject_items
  validate constraint student_history_subject_items_numeric_check;

-- =========================================================
-- 8) RLS E PERMISSÕES
-- =========================================================

do $do$
declare
  tbl text;
begin
  foreach tbl in array array[
    'school_itinerary_offers',
    'student_itinerary_selections',
    'student_history_subject_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);

    execute format('drop policy if exists staff_select on public.%I', tbl);
    execute format('drop policy if exists staff_insert on public.%I', tbl);
    execute format('drop policy if exists staff_update on public.%I', tbl);
    execute format('drop policy if exists staff_delete on public.%I', tbl);

    execute format(
      'create policy staff_select on public.%I for select to authenticated using (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    execute format(
      'create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    execute format(
      'create policy staff_update on public.%I for update to authenticated using (public.is_staff_active_in_school(%I.school_id)) with check (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl, tbl
    );

    execute format(
      'create policy staff_delete on public.%I for delete to authenticated using (public.is_staff_active_in_school(%I.school_id))',
      tbl, tbl
    );

    execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
  end loop;
end
$do$;

commit;