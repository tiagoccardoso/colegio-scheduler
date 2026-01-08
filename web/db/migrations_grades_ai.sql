
-- db/migrations_grades_ai.sql
-- Rodar no SQL Editor do Supabase.

-- 0) schools (opcional, mas recomendado para imprimir nome/semestre)
create table if not exists public.schools (
  id uuid primary key,
  name text null,
  term_label text null,
  created_at timestamptz not null default now()
);

alter table public.schools enable row level security;

-- Policies básicas: cada escola é "dona" do registro com id = auth.uid()
drop policy if exists "school owner can read" on public.schools;
create policy "school owner can read"
on public.schools for select to authenticated
using (id = auth.uid());

drop policy if exists "school owner can insert" on public.schools;
create policy "school owner can insert"
on public.schools for insert to authenticated
with check (id = auth.uid());

drop policy if exists "school owner can update" on public.schools;
create policy "school owner can update"
on public.schools for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- 1) subjects
alter table if exists public.subjects
  add column if not exists short_name text,
  add column if not exists display_order int;

-- 2) rooms
alter table if exists public.rooms
  add column if not exists room_number int,
  add column if not exists display_order int;

-- 3) classes
alter table if exists public.classes
  add column if not exists level text,
  add column if not exists stage text,
  add column if not exists default_room_id uuid references public.rooms(id) on delete set null,
  add column if not exists display_order int;

-- 4) teachers
alter table if exists public.teachers
  add column if not exists short_name text;

-- 5) class_subject_requirements
alter table if exists public.class_subject_requirements
  add column if not exists max_per_day int,
  add column if not exists block_size int,
  add column if not exists min_days int,
  add column if not exists prefer_consecutive boolean;

-- Optional indexes
create index if not exists idx_time_slots_school_shift_weekday on public.time_slots(school_id, shift, weekday);
create index if not exists idx_schedules_school on public.schedules(school_id, class_id);
