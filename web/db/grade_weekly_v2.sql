-- Colégio Scheduler — Grade Semanal v2 (Turnos + até 6 períodos + histórico)
-- Execute este script no Supabase (SQL Editor) no schema public.

-- Turnos suportados: MANHA | TARDE | NOITE

-- =====================
-- 1) Professores
-- =====================

alter table public.teachers
  add column if not exists shifts text[] not null default '{MANHA,TARDE,NOITE}'::text[],
  add column if not exists subject_id uuid,
  add column if not exists default_room_id uuid,
  add column if not exists availability jsonb,
  add column if not exists teaching_rules jsonb not null default '[]'::jsonb;

-- Valida valores de turno
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teachers_shifts_valid'
  ) then
    alter table public.teachers
      add constraint teachers_shifts_valid
      check (
        (select coalesce(bool_and(s in ('MANHA','TARDE','NOITE')), true) from unnest(shifts) as s)
      );
  end if;
end $$;

-- E-mail único por escola (case-insensitive) — opcional mas altamente recomendado
create unique index if not exists teachers_uq_school_email
  on public.teachers (school_id, lower(email))
  where email is not null;

-- Backfill opcional a partir do modelo antigo (subject_ids/room_ids)
update public.teachers
set subject_id = subject_ids[1]
where subject_id is null
  and subject_ids is not null
  and array_length(subject_ids, 1) > 0;

update public.teachers
set default_room_id = room_ids[1]
where default_room_id is null
  and room_ids is not null
  and array_length(room_ids, 1) > 0;


-- =====================
-- 2) Horários (time_slots)
-- =====================

alter table public.time_slots
  add column if not exists shift text not null default 'MANHA',
  add column if not exists period_index int;

-- Valida turno e período
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_slots_shift_valid'
  ) then
    alter table public.time_slots
      add constraint time_slots_shift_valid
      check (shift in ('MANHA','TARDE','NOITE'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'time_slots_period_index_valid'
  ) then
    alter table public.time_slots
      add constraint time_slots_period_index_valid
      check (period_index is null or (period_index between 1 and 6));
  end if;
end $$;

-- Backfill do period_index (para bancos existentes) — ordena por horário dentro do dia
with ranked as (
  select id,
         row_number() over (partition by school_id, shift, weekday order by starts_at) as rn
  from public.time_slots
  where period_index is null
)
update public.time_slots t
set period_index = r.rn
from ranked r
where t.id = r.id;

-- Unique key para gerar/atualizar calendário por turno/dia/período
create unique index if not exists time_slots_uq_school_shift_weekday_period
  on public.time_slots (school_id, shift, weekday, period_index)
  where period_index is not null;


-- =====================
-- 3) Schedules (observações)
-- =====================

alter table public.schedules
  add column if not exists notes text;


-- =====================
-- 4) Auditoria (histórico + undo/redo)
-- =====================

create table if not exists public.schedule_audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  user_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  redone_at timestamptz
);

create index if not exists schedule_audit_events_school_created_at_idx
  on public.schedule_audit_events (school_id, created_at desc);
