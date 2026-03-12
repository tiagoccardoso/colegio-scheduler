-- Matriz curricular por slot (com professor opcional)
-- Permite distribuir disciplinas por turma antes da alocação de professores,
-- e depois vincular o professor diretamente na célula da matriz.
-- Rode este patch no SQL Editor do Supabase.

create table if not exists public.curriculum_matrix_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  time_slot_id uuid not null,
  subject_id uuid not null,
  teacher_id uuid null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint curriculum_matrix_slots_unique unique (school_id, class_id, time_slot_id),
  constraint curriculum_matrix_slots_class_fk
    foreign key (class_id) references public.classes(id) on delete cascade,
  constraint curriculum_matrix_slots_slot_fk
    foreign key (time_slot_id) references public.time_slots(id) on delete cascade,
  constraint curriculum_matrix_slots_subject_fk
    foreign key (subject_id) references public.subjects(id) on delete cascade,
  constraint curriculum_matrix_slots_teacher_fk
    foreign key (teacher_id) references public.teachers(id) on delete set null
);

alter table if exists public.curriculum_matrix_slots
  add column if not exists teacher_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'curriculum_matrix_slots_teacher_fk'
  ) then
    alter table public.curriculum_matrix_slots
      add constraint curriculum_matrix_slots_teacher_fk
      foreign key (teacher_id) references public.teachers(id) on delete set null;
  end if;
end $$;

create index if not exists curriculum_matrix_slots_school_idx
  on public.curriculum_matrix_slots (school_id);

create index if not exists curriculum_matrix_slots_class_idx
  on public.curriculum_matrix_slots (class_id);

create index if not exists curriculum_matrix_slots_slot_idx
  on public.curriculum_matrix_slots (time_slot_id);

create index if not exists curriculum_matrix_slots_subject_idx
  on public.curriculum_matrix_slots (subject_id);

create index if not exists curriculum_matrix_slots_teacher_idx
  on public.curriculum_matrix_slots (teacher_id);

create or replace function public.touch_curriculum_matrix_slots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_curriculum_matrix_slots_updated_at on public.curriculum_matrix_slots;
create trigger trg_curriculum_matrix_slots_updated_at
before update on public.curriculum_matrix_slots
for each row execute function public.touch_curriculum_matrix_slots_updated_at();

alter table public.curriculum_matrix_slots enable row level security;

drop policy if exists staff_select on public.curriculum_matrix_slots;
drop policy if exists staff_insert on public.curriculum_matrix_slots;
drop policy if exists staff_update on public.curriculum_matrix_slots;
drop policy if exists staff_delete on public.curriculum_matrix_slots;

create policy staff_select
on public.curriculum_matrix_slots
for select
to authenticated
using (public.is_staff_active_in_school(curriculum_matrix_slots.school_id));

create policy staff_insert
on public.curriculum_matrix_slots
for insert
to authenticated
with check (public.is_staff_active_in_school(curriculum_matrix_slots.school_id));

create policy staff_update
on public.curriculum_matrix_slots
for update
to authenticated
using (public.is_staff_active_in_school(curriculum_matrix_slots.school_id))
with check (public.is_staff_active_in_school(curriculum_matrix_slots.school_id));

create policy staff_delete
on public.curriculum_matrix_slots
for delete
to authenticated
using (public.is_staff_active_in_school(curriculum_matrix_slots.school_id));

grant select, insert, update, delete on public.curriculum_matrix_slots to authenticated;
