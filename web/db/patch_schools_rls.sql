-- Patch de RLS para public.schools
-- Corrige o erro: "new row violates row-level security policy for table \"schools\""
--
-- Este patch permite leitura/insert/update do colégio quando:
--   1) schools.id = auth.uid()  (modelo 1 diretor -> 1 colégio)
--      OU
--   2) existe um perfil apontando para esse colégio (profiles.school_id = schools.id)
--      e o usuário é diretor (para escrever).

alter table public.schools enable row level security;

-- Remove policies antigas (se existirem)
drop policy if exists "school owner can read" on public.schools;
drop policy if exists "school owner can insert" on public.schools;
drop policy if exists "school owner can update" on public.schools;

drop policy if exists "school access can read" on public.schools;
drop policy if exists "school access can insert" on public.schools;
drop policy if exists "school access can update" on public.schools;

-- SELECT: dono (id = auth.uid) OU membro via profiles
create policy "school access can read"
on public.schools
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = schools.id
  )
);

-- INSERT: dono (id = auth.uid) OU diretor vinculado via profiles
create policy "school access can insert"
on public.schools
for insert
to authenticated
with check (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'director'
      and p.school_id = schools.id
  )
);

-- UPDATE: dono (id = auth.uid) OU diretor vinculado via profiles
create policy "school access can update"
on public.schools
for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'director'
      and p.school_id = schools.id
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'director'
      and p.school_id = schools.id
  )
);

-- (Opcional) grants explícitos
grant select, insert, update on public.schools to authenticated;
