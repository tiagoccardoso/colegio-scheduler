-- Quadro de Aulas — Adequação SEED-PR (Supabase/PostgreSQL)
-- Execute este script no Supabase (SQL Editor) no schema public.
--
-- Entregáveis neste arquivo:
-- 1) ALTER TABLE + constraints (turnos 6/6/5 + tipo de atividade AULA/HA + carga 20h)
-- 2) Funções/Triggers (anti-choque por sobreposição de horário + descanso 11h Noite→Manhã)
-- 3) Views (validação 33% e mapa geral do diretor)

-- ============================================================
-- 0) Pré-requisitos
-- ============================================================
-- Este script assume as tabelas já existentes:
-- public.teachers, public.time_slots, public.schedules, public.classes,
-- public.subjects, public.rooms.


-- ============================================================
-- 1) Estrutura 3 Turnos (6/6/5) — time_slots
-- ============================================================
-- Regra SEED-PR solicitada:
-- - MANHA: 6 aulas (50 min)
-- - TARDE: 6 aulas (50 min)
-- - NOITE: 5 aulas

-- Ajusta constraint para permitir 1..6 (manhã/tarde) e 1..5 (noite)
-- Obs: antes de criar a nova constraint, limpamos dados inválidos existentes.
alter table public.time_slots
  drop constraint if exists time_slots_period_index_valid;

-- Se o banco já tinha NOITE com 6+ períodos, neutraliza (mantém o registro, mas solta o índice do período)
update public.time_slots
set period_index = null
where shift = 'NOITE'
  and period_index is not null
  and period_index > 5;

alter table public.time_slots
  add constraint time_slots_period_index_valid
  check (
    period_index is null
    or (
      (shift in ('MANHA','TARDE') and period_index between 1 and 6)
      or (shift = 'NOITE' and period_index between 1 and 5)
    )
  );


-- ============================================================
-- 2) Lógica 33% (13 Aulas + 7 HAs por padrão 20h)
-- ============================================================
-- Modelo:
-- - Um professor tem N padrões de 20h (1=20h, 2=40h, ...)
-- - Em cada padrão: 13 slots do tipo AULA + 7 slots do tipo HA

alter table public.teachers
  add column if not exists workload_20h_blocks smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'teachers_workload_20h_blocks_valid'
  ) then
    alter table public.teachers
      add constraint teachers_workload_20h_blocks_valid
      check (workload_20h_blocks >= 1 and workload_20h_blocks <= 4);
  end if;
end $$;

-- Schedules: adiciona tipo de atividade para suportar HA dentro da grade
alter table public.schedules
  add column if not exists activity_type text not null default 'AULA';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schedules_activity_type_valid'
  ) then
    alter table public.schedules
      add constraint schedules_activity_type_valid
      check (activity_type in ('AULA','HA'));
  end if;
end $$;

-- Para permitir HA (sem turma/sem disciplina), relaxa NOT NULL se existir.
alter table public.schedules
  alter column class_id drop not null,
  alter column subject_id drop not null;

-- Reforça regra: AULA exige turma+disciplina; HA não exige (e por padrão fica sem turma/sem disciplina)
alter table public.schedules
  drop constraint if exists schedules_aula_ha_shape_valid;

alter table public.schedules
  add constraint schedules_aula_ha_shape_valid
  check (
    (activity_type = 'AULA' and class_id is not null and subject_id is not null)
    or (activity_type = 'HA' and class_id is null and subject_id is null)
  );

-- View de validação (SQL) — regra 13 Aulas + 7 HAs por 20h
create or replace view public.vw_seed_pr_teacher_workload_validation as
select
  t.school_id,
  t.id as teacher_id,
  t.name as teacher_name,
  t.workload_20h_blocks,
  coalesce(sum(case when s.activity_type = 'AULA' then 1 else 0 end), 0) as aulas_slots,
  coalesce(sum(case when s.activity_type = 'HA' then 1 else 0 end), 0) as ha_slots,
  coalesce(count(s.id), 0) as total_slots,
  (13 * t.workload_20h_blocks) as max_aulas_slots,
  (7 * t.workload_20h_blocks) as min_ha_slots,
  (20 * t.workload_20h_blocks) as max_total_slots,
  (coalesce(sum(case when s.activity_type = 'AULA' then 1 else 0 end), 0) <= (13 * t.workload_20h_blocks)) as ok_aulas,
  (coalesce(sum(case when s.activity_type = 'HA' then 1 else 0 end), 0) >= (7 * t.workload_20h_blocks)) as ok_has,
  (coalesce(count(s.id), 0) <= (20 * t.workload_20h_blocks)) as ok_total,
  (
    (coalesce(sum(case when s.activity_type = 'AULA' then 1 else 0 end), 0) <= (13 * t.workload_20h_blocks))
    and (coalesce(sum(case when s.activity_type = 'HA' then 1 else 0 end), 0) >= (7 * t.workload_20h_blocks))
    and (coalesce(count(s.id), 0) <= (20 * t.workload_20h_blocks))
  ) as ok_all,
  greatest(0, (13 * t.workload_20h_blocks) - coalesce(sum(case when s.activity_type = 'AULA' then 1 else 0 end), 0)) as aulas_slots_disponiveis,
  greatest(0, (7 * t.workload_20h_blocks) - coalesce(sum(case when s.activity_type = 'HA' then 1 else 0 end), 0)) as ha_slots_faltando,
  (20 * t.workload_20h_blocks) - coalesce(count(s.id), 0) as slots_restantes
from public.teachers t
left join public.schedules s
  on s.school_id = t.school_id
 and s.teacher_id = t.id
group by t.school_id, t.id, t.name, t.workload_20h_blocks;


-- ============================================================
-- 3) Validação de Conflitos — trigger/função
-- ============================================================
-- Regras:
-- (a) Impedir sobreposição de horário do MESMO professor (não só por time_slot_id, mas por overlaps)
-- (b) Validar 11h de intervalo entre NOITE (dia anterior) e MANHA (dia seguinte)

create or replace function public.trg_schedules_seed_pr_validate_conflicts()
returns trigger
language plpgsql
as $$
declare
  ts_new record;
  other record;
  prev_day int;
  next_day int;
begin
  -- Ignore linhas sem professor/horário
  if new.teacher_id is null or new.time_slot_id is null then
    return new;
  end if;

  select ts.weekday, ts.shift, ts.starts_at, ts.ends_at
    into ts_new
  from public.time_slots ts
  where ts.id = new.time_slot_id;

  if not found then
    raise exception 'Horário (time_slot_id=%) não encontrado.', new.time_slot_id;
  end if;

  -- (a) Checagem de sobreposição por faixa de horário (mesmo dia da semana)
  select
    s.id as schedule_id,
    ts.weekday,
    ts.shift,
    ts.starts_at,
    ts.ends_at
  into other
  from public.schedules s
  join public.time_slots ts on ts.id = s.time_slot_id
  where s.school_id = new.school_id
    and s.teacher_id = new.teacher_id
    and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ts.weekday = ts_new.weekday
    and (ts.starts_at, ts.ends_at) overlaps (ts_new.starts_at, ts_new.ends_at)
  limit 1;

  if found then
    raise exception using
      message = format(
        'Conflito: professor já possui compromisso em %s (%s %s–%s).',
        case other.weekday
          when 1 then 'Segunda'
          when 2 then 'Terça'
          when 3 then 'Quarta'
          when 4 then 'Quinta'
          when 5 then 'Sexta'
          when 6 then 'Sábado'
          when 7 then 'Domingo'
          else 'Dia'
        end,
        other.shift,
        other.starts_at,
        other.ends_at
      ),
      errcode = 'check_violation';
  end if;

  -- (b) Descanso 11h entre NOITE e MANHA (dias consecutivos)
  prev_day := case when ts_new.weekday = 1 then 7 else ts_new.weekday - 1 end;
  next_day := case when ts_new.weekday = 7 then 1 else ts_new.weekday + 1 end;

  -- Se está inserindo/atualizando MANHA: verifica NOITE do dia anterior
  if upper(coalesce(ts_new.shift::text, '')) = 'MANHA' then
    if exists (
      select 1
      from public.schedules s_prev
      join public.time_slots ts_prev on ts_prev.id = s_prev.time_slot_id
      where s_prev.school_id = new.school_id
        and s_prev.teacher_id = new.teacher_id
        and s_prev.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and ts_prev.weekday = prev_day
        and upper(coalesce(ts_prev.shift::text, '')) = 'NOITE'
        and ((ts_new.starts_at - ts_prev.ends_at) + interval '24 hours') < interval '11 hours'
    ) then
      raise exception using
        message = 'Regra SEED-PR: deve haver no mínimo 11h de intervalo entre NOITE e MANHA (professor não pode sair da noite e entrar na manhã seguinte).',
        errcode = 'check_violation';
    end if;
  end if;

  -- Se está inserindo/atualizando NOITE: verifica MANHA do dia seguinte
  if upper(coalesce(ts_new.shift::text, '')) = 'NOITE' then
    if exists (
      select 1
      from public.schedules s_next
      join public.time_slots ts_next on ts_next.id = s_next.time_slot_id
      where s_next.school_id = new.school_id
        and s_next.teacher_id = new.teacher_id
        and s_next.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and ts_next.weekday = next_day
        and upper(coalesce(ts_next.shift::text, '')) = 'MANHA'
        and ((ts_next.starts_at - ts_new.ends_at) + interval '24 hours') < interval '11 hours'
    ) then
      raise exception using
        message = 'Regra SEED-PR: deve haver no mínimo 11h de intervalo entre NOITE e MANHA (professor não pode entrar na manhã seguinte após aula na noite anterior).',
        errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_seed_pr_validate_conflicts on public.schedules;

create trigger schedules_seed_pr_validate_conflicts
before insert or update of teacher_id, time_slot_id
on public.schedules
for each row
execute function public.trg_schedules_seed_pr_validate_conflicts();


-- ============================================================
-- 4) Visão do Diretor — mapa geral de ocupação
-- ============================================================
-- Uma linha por time_slot (dia/turno/período) com um array JSON de ocupações.
-- Isso permite montar um "mapa geral" sem precisar de pivot rígido no SQL.

create or replace view public.vw_director_occupation_map as
select
  ts.school_id,
  ts.weekday,
  ts.shift,
  ts.period_index,
  ts.starts_at,
  ts.ends_at,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'schedule_id', s.id,
        'activity_type', s.activity_type,
        'teacher_id', t.id,
        'teacher_name', t.name,
        'class_id', c.id,
        'class_name', c.name,
        'class_shift', c.shift,
        'subject_id', sub.id,
        'subject_name', sub.name,
        'room_id', r.id,
        'room_name', r.name,
        'notes', s.notes
      )
      order by coalesce(t.name, ''), coalesce(c.name, ''), coalesce(sub.name, '')
    ) filter (where s.id is not null),
    '[]'::jsonb
  ) as assignments
from public.time_slots ts
left join public.schedules s
  on s.school_id = ts.school_id
 and s.time_slot_id = ts.id
left join public.teachers t on t.id = s.teacher_id
left join public.classes c on c.id = s.class_id
left join public.subjects sub on sub.id = s.subject_id
left join public.rooms r on r.id = s.room_id
group by ts.school_id, ts.id, ts.weekday, ts.shift, ts.period_index, ts.starts_at, ts.ends_at;

-- Índice opcional para acelerar consultas por escola/turno/dia
create index if not exists time_slots_school_shift_weekday_idx
  on public.time_slots (school_id, shift, weekday, period_index);
