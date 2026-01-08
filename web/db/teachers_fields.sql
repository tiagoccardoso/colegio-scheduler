-- Colégio Scheduler — Campos adicionais para Professores
-- Execute este script no Supabase (SQL Editor) no schema public.

alter table public.teachers
  add column if not exists subject_ids uuid[] not null default '{}'::uuid[],
  add column if not exists class_ids uuid[] not null default '{}'::uuid[],
  add column if not exists room_ids uuid[] not null default '{}'::uuid[],
  add column if not exists teaching_rules jsonb not null default '[]'::jsonb,
  add column if not exists restrictions text,
  add column if not exists available_weekdays int[] not null default '{1,2,3,4,5}'::int[];

-- Garante que os dias sejam 1..7 (Seg..Dom)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teachers_available_weekdays_valid'
  ) then
    alter table public.teachers
      add constraint teachers_available_weekdays_valid
      check (
        (select coalesce(bool_and(d between 1 and 7), true) from unnest(available_weekdays) as d)
      );
  end if;
end $$;

-- Normaliza dados antigos (se existirem nulos)
update public.teachers
set
  subject_ids = coalesce(subject_ids, '{}'::uuid[]),
  class_ids = coalesce(class_ids, '{}'::uuid[]),
  room_ids = coalesce(room_ids, '{}'::uuid[]),
  teaching_rules = coalesce(teaching_rules, '[]'::jsonb),
  available_weekdays = coalesce(available_weekdays, '{1,2,3,4,5}'::int[])
where
  subject_ids is null
  or class_ids is null
  or room_ids is null
  or teaching_rules is null
  or available_weekdays is null;
