-- Colégio Scheduler — Novo Ensino Médio / Fase 7
-- Objetivo: completar os cadastros-base (turmas, componentes, docentes e salas)
-- para atender com mais aderência as exigências de oferta, docência e infraestrutura.

alter table if exists public.classes
  add column if not exists school_year integer null,
  add column if not exists itinerary_axis text null,
  add column if not exists itinerary_name text null,
  add column if not exists max_students integer null,
  add column if not exists vacancies integer null,
  add column if not exists active boolean not null default true,
  add column if not exists pedagogical_notes text null;

alter table if exists public.subjects
  add column if not exists annual_hours integer null,
  add column if not exists weekly_lessons_suggested integer null,
  add column if not exists itinerary_axis text null,
  add column if not exists syllabus text null,
  add column if not exists teacher_qualification_required text null,
  add column if not exists is_mandatory boolean not null default false;

alter table if exists public.teachers
  add column if not exists cpf text null,
  add column if not exists academic_degree text null,
  add column if not exists licensure_area text null,
  add column if not exists additional_areas text[] null,
  add column if not exists employee_code text null,
  add column if not exists can_teach_nem boolean not null default true,
  add column if not exists can_teach_technical boolean not null default false,
  add column if not exists curriculum_lattes_url text null,
  add column if not exists training_notes text null;

alter table if exists public.rooms
  add column if not exists capacity integer null,
  add column if not exists building_block text null,
  add column if not exists supports_digital_education boolean not null default false,
  add column if not exists supports_professional_training boolean not null default false,
  add column if not exists is_accessible boolean not null default false,
  add column if not exists notes text null;

create index if not exists classes_school_year_idx on public.classes (school_id, school_year);
create index if not exists classes_itinerary_axis_idx on public.classes (school_id, itinerary_axis);
create index if not exists subjects_itinerary_axis_idx on public.subjects (school_id, itinerary_axis);
create index if not exists teachers_employee_code_idx on public.teachers (school_id, employee_code);
create index if not exists rooms_capacity_idx on public.rooms (school_id, capacity);

update public.classes
set school_year = extract(year from now())::integer
where school_year is null;

update public.classes
set vacancies = coalesce(vacancies, max_students)
where vacancies is null and max_students is not null;

update public.subjects
set is_mandatory = true
where coalesce(component_type, '') = 'FGB' and is_mandatory = false;
