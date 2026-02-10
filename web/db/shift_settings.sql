-- Configuração de intervalo (gap) por turno
-- Execute no Supabase (SQL Editor) no schema public.

create table if not exists public.shift_settings (
  school_id uuid not null references public.schools(id) on delete cascade,
  shift text not null,
  interval_minutes integer not null default 0,
  -- Após qual período o intervalo começa (ex.: 3 => 4º período começa mais tarde)
  interval_after_period integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (school_id, shift),
  constraint shift_settings_shift_valid check (shift in ('MANHA','TARDE','NOITE')),
  constraint shift_settings_interval_valid check (interval_minutes >= 0 and interval_minutes <= 180)
);

-- Upgrade (idempotente) para instâncias que já tinham a tabela criada
alter table public.shift_settings
  add column if not exists interval_after_period integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shift_settings_after_period_valid') then
    alter table public.shift_settings
      add constraint shift_settings_after_period_valid
      check (interval_after_period >= 0 and interval_after_period <= 6);
  end if;
end;
$$;

create index if not exists shift_settings_school_id_idx
  on public.shift_settings (school_id);

-- Timestamp helper (idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shift_settings_touch_updated_at on public.shift_settings;
create trigger shift_settings_touch_updated_at
before update on public.shift_settings
for each row execute function public.touch_updated_at();
