-- Colégio Scheduler — Novo Ensino Médio / Fase 5
-- Objetivo: acrescentar validação automática por currículo estadual,
-- com parâmetros locais, componentes obrigatórios customizáveis e
-- réguas efetivas de carga horária.

alter table if exists public.school_curriculum_settings
  add column if not exists state_code varchar(2) null,
  add column if not exists state_curriculum_name text null,
  add column if not exists state_curriculum_version text null,
  add column if not exists state_reference_url text null,
  add column if not exists curriculum_alignment_notes text null,
  add column if not exists state_override_total_annual_hours_target integer null,
  add column if not exists state_override_fgb_min_hours_regular integer null,
  add column if not exists state_override_itinerary_min_hours_regular integer null,
  add column if not exists state_override_min_itineraries_per_school integer null,
  add column if not exists required_fgb_codes_override text[] null,
  add column if not exists enforce_digital_education boolean not null default true,
  add column if not exists enforce_project_of_life boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_curriculum_settings_state_code_check'
      and conrelid = 'public.school_curriculum_settings'::regclass
  ) then
    alter table public.school_curriculum_settings
      add constraint school_curriculum_settings_state_code_check
      check (
        state_code is null
        or upper(state_code) in (
          'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
          'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
        )
      );
  end if;
end $$;

update public.school_curriculum_settings
set required_fgb_codes_override = array['LP','LI','ART','EDF','MAT','BIO','FIS','QUI','FIL','GEO','HIS','SOC']
where required_fgb_codes_override is null;

alter table public.school_curriculum_settings
  alter column required_fgb_codes_override set default array['LP','LI','ART','EDF','MAT','BIO','FIS','QUI','FIL','GEO','HIS','SOC'];

create index if not exists school_curriculum_settings_state_code_idx
  on public.school_curriculum_settings (state_code);
