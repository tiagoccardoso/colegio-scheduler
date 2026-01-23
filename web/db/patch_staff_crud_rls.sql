-- Patch de permissões (RLS) para permitir que DIRETOR e EQUIPE PEDAGÓGICA
-- façam CRUD (inserir/atualizar/excluir) nos Cadastros e na Grade.
--
-- Corrige erros como:
--   new row violates row-level security policy for table "subjects"
--
-- Regras:
--   - Diretor: acesso total aos dados da própria escola.
--   - Equipe pedagógica: acesso aos dados da escola somente se estiver ATIVA
--     (pedagogical_team.disabled_at IS NULL).
--   - Painel do Diretor/Assinaturas seguem restritos na aplicação.
--
-- Rode este patch no SQL Editor do Supabase.

-- Garante coluna de status na equipe pedagógica (para inativação)
alter table if exists public.pedagogical_team
  add column if not exists disabled_at timestamptz null,
  add column if not exists disabled_by uuid null;

-- Helper: expressão de acesso para staff (diretor ou pedagógico ativo)
-- Usar como:
--   (public.is_staff_active_in_school(<table>.school_id))
create or replace function public.is_staff_active_in_school(target_school_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.school_id = target_school_id
        and p.role = 'director'
    )
    or (
      exists (
        select 1
        from public.profiles p
        where p.user_id = auth.uid()
          and p.school_id = target_school_id
          and p.role = 'pedagogical'
      )
      and exists (
        select 1
        from public.pedagogical_team pt
        where pt.user_id = auth.uid()
          and pt.school_id = target_school_id
          and pt.disabled_at is null
      )
    );
$$;

grant execute on function public.is_staff_active_in_school(uuid) to authenticated;

-- Aplica policies padrão (SELECT/INSERT/UPDATE/DELETE) por escola
-- em todas as tabelas de Cadastros/Grade.

do $do$
declare
  tbl text;
begin
  foreach tbl in array array[
    'subjects',
    'teachers',
    'rooms',
    'classes',
    'time_slots',
    'shift_settings',
    'schedules',
    'class_subject_requirements'
  ]
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security', tbl);

      execute format('drop policy if exists staff_select on public.%I', tbl);
      execute format('drop policy if exists staff_insert on public.%I', tbl);
      execute format('drop policy if exists staff_update on public.%I', tbl);
      execute format('drop policy if exists staff_delete on public.%I', tbl);

      execute format(
        'create policy staff_select on public.%I for select to authenticated using (public.is_staff_active_in_school(%I.school_id))',
        tbl, tbl
      );

      execute format(
        'create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff_active_in_school(%I.school_id))',
        tbl, tbl
      );

      execute format(
        'create policy staff_update on public.%I for update to authenticated using (public.is_staff_active_in_school(%I.school_id)) with check (public.is_staff_active_in_school(%I.school_id))',
        tbl, tbl, tbl
      );

      execute format(
        'create policy staff_delete on public.%I for delete to authenticated using (public.is_staff_active_in_school(%I.school_id))',
        tbl, tbl
      );

      execute format('grant select, insert, update, delete on public.%I to authenticated', tbl);
    end if;
  end loop;
end
$do$;

-- schedule_audit_events tem regra extra no INSERT (user_id deve ser o próprio auth.uid())
do $do$
begin
  if to_regclass('public.schedule_audit_events') is not null then
    alter table public.schedule_audit_events enable row level security;

    drop policy if exists staff_select on public.schedule_audit_events;
    drop policy if exists staff_insert on public.schedule_audit_events;
    drop policy if exists staff_update on public.schedule_audit_events;
    drop policy if exists staff_delete on public.schedule_audit_events;

    create policy staff_select
    on public.schedule_audit_events
    for select
    to authenticated
    using (public.is_staff_active_in_school(schedule_audit_events.school_id));

    create policy staff_insert
    on public.schedule_audit_events
    for insert
    to authenticated
    with check (
      public.is_staff_active_in_school(schedule_audit_events.school_id)
      and schedule_audit_events.user_id = auth.uid()
    );

    create policy staff_update
    on public.schedule_audit_events
    for update
    to authenticated
    using (public.is_staff_active_in_school(schedule_audit_events.school_id))
    with check (public.is_staff_active_in_school(schedule_audit_events.school_id));

    create policy staff_delete
    on public.schedule_audit_events
    for delete
    to authenticated
    using (public.is_staff_active_in_school(schedule_audit_events.school_id));

    grant select, insert, update, delete on public.schedule_audit_events to authenticated;
  end if;
end
$do$;
