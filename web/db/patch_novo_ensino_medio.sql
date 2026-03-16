-- Colégio Scheduler — Adequações para o Novo Ensino Médio
-- Execute este script no SQL Editor do Supabase, no schema public.
-- Objetivo: enriquecer subjects/classes com metadados curriculares e criar
-- uma tabela de parâmetros por escola para validar conformidade do NEM.

alter table if exists public.subjects
  add column if not exists component_type text null,
  add column if not exists knowledge_area text null,
  add column if not exists nem_component_code text null,
  add column if not exists is_digital_education boolean not null default false,
  add column if not exists is_project_of_life boolean not null default false,
  add column if not exists is_elective boolean not null default false,
  add column if not exists is_professional_training boolean not null default false,
  add column if not exists curriculum_notes text null;

alter table if exists public.classes
  add column if not exists entry_cohort integer null,
  add column if not exists curriculum_version text null,
  add column if not exists offer_model text null,
  add column if not exists series_year text null;

create table if not exists public.school_curriculum_settings (
  school_id uuid primary key,
  weeks_per_school_year integer not null default 40,
  minutes_per_lesson integer not null default 50,
  total_annual_hours_target integer not null default 3000,
  fgb_min_hours_regular integer not null default 2400,
  itinerary_min_hours_regular integer not null default 600,
  technical_fgb_min_hours_800 integer not null default 2200,
  technical_fgb_min_hours_1000 integer not null default 2100,
  technical_fgb_min_hours_1200 integer not null default 2100,
  min_itineraries_per_school integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint school_curriculum_settings_school_fk
    foreign key (school_id) references public.schools(id) on delete cascade,
  constraint school_curriculum_settings_weeks_check check (weeks_per_school_year between 20 and 60),
  constraint school_curriculum_settings_minutes_check check (minutes_per_lesson between 30 and 90),
  constraint school_curriculum_settings_total_hours_check check (total_annual_hours_target between 600 and 5000),
  constraint school_curriculum_settings_fgb_regular_check check (fgb_min_hours_regular between 400 and 5000),
  constraint school_curriculum_settings_itinerary_check check (itinerary_min_hours_regular between 0 and 3000),
  constraint school_curriculum_settings_tech_800_check check (technical_fgb_min_hours_800 between 400 and 5000),
  constraint school_curriculum_settings_tech_1000_check check (technical_fgb_min_hours_1000 between 400 and 5000),
  constraint school_curriculum_settings_tech_1200_check check (technical_fgb_min_hours_1200 between 400 and 5000),
  constraint school_curriculum_settings_itineraries_count_check check (min_itineraries_per_school between 1 and 10)
);

create index if not exists subjects_component_type_idx on public.subjects (school_id, component_type);
create index if not exists subjects_knowledge_area_idx on public.subjects (school_id, knowledge_area);
create index if not exists subjects_nem_component_code_idx on public.subjects (school_id, nem_component_code);
create index if not exists classes_offer_model_idx on public.classes (school_id, offer_model);
create index if not exists classes_entry_cohort_idx on public.classes (school_id, entry_cohort);

create or replace function public.touch_school_curriculum_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_school_curriculum_settings_updated_at on public.school_curriculum_settings;
create trigger trg_school_curriculum_settings_updated_at
before update on public.school_curriculum_settings
for each row execute function public.touch_school_curriculum_settings_updated_at();

alter table public.school_curriculum_settings enable row level security;

drop policy if exists staff_select on public.school_curriculum_settings;
drop policy if exists staff_insert on public.school_curriculum_settings;
drop policy if exists staff_update on public.school_curriculum_settings;
drop policy if exists staff_delete on public.school_curriculum_settings;

create policy staff_select
on public.school_curriculum_settings
for select
to authenticated
using (public.is_staff_active_in_school(school_curriculum_settings.school_id));

create policy staff_insert
on public.school_curriculum_settings
for insert
to authenticated
with check (public.is_staff_active_in_school(school_curriculum_settings.school_id));

create policy staff_update
on public.school_curriculum_settings
for update
to authenticated
using (public.is_staff_active_in_school(school_curriculum_settings.school_id))
with check (public.is_staff_active_in_school(school_curriculum_settings.school_id));

create policy staff_delete
on public.school_curriculum_settings
for delete
to authenticated
using (public.is_staff_active_in_school(school_curriculum_settings.school_id));

grant select, insert, update, delete on public.school_curriculum_settings to authenticated;
