-- Tabela de Equipe Pedagógica
-- Objetivo: manter um registro explícito (por escola) dos usuários com acesso de equipe pedagógica.
-- Observação: a autorização no app continua baseada em public.profiles.role ('pedagogical').

create table if not exists public.pedagogical_team (
  user_id uuid primary key,
  school_id uuid not null,
  full_name text,
  -- Se preenchido, o acesso da equipe pedagógica fica bloqueado.
  disabled_at timestamptz null,
  disabled_by uuid null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Compatibilidade: caso a tabela já exista (rodou uma versão anterior do script)
alter table public.pedagogical_team
  add column if not exists disabled_at timestamptz null,
  add column if not exists disabled_by uuid null;

-- FK opcional para garantir consistência com o cadastro do colégio
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema='public'
      and table_name='pedagogical_team'
      and constraint_name='pedagogical_team_school_fk'
  ) then
    alter table public.pedagogical_team
      add constraint pedagogical_team_school_fk
      foreign key (school_id) references public.schools(id)
      on delete cascade;
  end if;
end $$;

-- FK opcional para garantir que exista profile (o fluxo do app faz UPSERT em profiles)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema='public'
      and table_name='pedagogical_team'
      and constraint_name='pedagogical_team_user_fk'
  ) then
    alter table public.pedagogical_team
      add constraint pedagogical_team_user_fk
      foreign key (user_id) references public.profiles(user_id)
      on delete cascade;
  end if;
end $$;

create index if not exists pedagogical_team_school_idx on public.pedagogical_team (school_id);

-- RLS
alter table public.pedagogical_team enable row level security;

drop policy if exists "directors can manage pedagogical team" on public.pedagogical_team;
drop policy if exists "members can read own pedagogical record" on public.pedagogical_team;

-- Diretores gerenciam a equipe (mesma escola)
create policy "directors can manage pedagogical team"
on public.pedagogical_team
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = pedagogical_team.school_id
      and p.role = 'director'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = pedagogical_team.school_id
      and p.role = 'director'
  )
);

-- Membro pode ler o próprio registro
create policy "members can read own pedagogical record"
on public.pedagogical_team
for select
to authenticated
using (
  user_id = auth.uid()
);

grant select, insert, update, delete on public.pedagogical_team to authenticated;
