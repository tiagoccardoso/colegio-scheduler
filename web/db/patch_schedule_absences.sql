-- Módulo de faltas e substituições por slot da grade
-- Execute este script no Supabase (SQL Editor) no schema public.

alter table public.schedules
  add column if not exists is_teacher_absent boolean not null default false,
  add column if not exists replacement_teacher_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedules_replacement_teacher_id_fkey'
  ) then
    alter table public.schedules
      add constraint schedules_replacement_teacher_id_fkey
      foreign key (replacement_teacher_id)
      references public.teachers(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'schedules_replacement_teacher_distinct'
  ) then
    alter table public.schedules
      add constraint schedules_replacement_teacher_distinct
      check (replacement_teacher_id is null or replacement_teacher_id <> teacher_id);
  end if;
end $$;

create index if not exists schedules_school_absent_idx
  on public.schedules (school_id, is_teacher_absent, replacement_teacher_id);

create index if not exists schedules_replacement_teacher_time_slot_idx
  on public.schedules (replacement_teacher_id, time_slot_id)
  where replacement_teacher_id is not null;

update public.schedules
set replacement_teacher_id = null,
    is_teacher_absent = false
where replacement_teacher_id = teacher_id;
