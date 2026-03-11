-- Parâmetros do Solve/Grade por escola
-- Execute este script no Supabase (SQL Editor) no schema public.

create table if not exists public.schedule_solver_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  prefer_consecutive_weight integer not null default 6,
  compact_teacher_days_weight integer not null default 5,
  reduce_teacher_gaps_weight integer not null default 7,
  avoid_last_period_penalty integer not null default 4,
  spread_subjects_weight integer not null default 6,
  respect_requirements boolean not null default true,
  prioritize_default_room boolean not null default true,
  updated_by uuid null references auth.users(id) on delete set null,
  updated_at timestamp with time zone not null default now(),
  constraint schedule_solver_settings_prefer_consecutive_chk check (prefer_consecutive_weight between 0 and 50),
  constraint schedule_solver_settings_compact_teacher_days_chk check (compact_teacher_days_weight between 0 and 50),
  constraint schedule_solver_settings_reduce_teacher_gaps_chk check (reduce_teacher_gaps_weight between 0 and 50),
  constraint schedule_solver_settings_avoid_last_period_chk check (avoid_last_period_penalty between 0 and 50),
  constraint schedule_solver_settings_spread_subjects_chk check (spread_subjects_weight between 0 and 50)
);

create or replace function public.trg_schedule_solver_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_solver_settings_touch_updated_at on public.schedule_solver_settings;
create trigger schedule_solver_settings_touch_updated_at
before update on public.schedule_solver_settings
for each row execute function public.trg_schedule_solver_settings_touch_updated_at();

alter table public.schedule_solver_settings enable row level security;

drop policy if exists "schedule_solver_settings_select_same_school" on public.schedule_solver_settings;
create policy "schedule_solver_settings_select_same_school"
on public.schedule_solver_settings
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = schedule_solver_settings.school_id
  )
);

drop policy if exists "schedule_solver_settings_upsert_director_same_school" on public.schedule_solver_settings;
create policy "schedule_solver_settings_upsert_director_same_school"
on public.schedule_solver_settings
for all
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = schedule_solver_settings.school_id
      and p.role = 'director'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = schedule_solver_settings.school_id
      and p.role = 'director'
  )
);
