-- Patch de RLS para public.profiles
-- Corrige o erro: "new row violates row-level security policy for table \"profiles\""
--
-- O fluxo /onboarding faz um UPSERT em public.profiles criando o registro do usuário.
-- Se a tabela estiver com RLS habilitado e não existir policy de INSERT (ou estiver incorreta),
-- o Postgres bloqueia a criação do perfil.
--
-- Premissas do projeto:
--   - profiles.user_id = auth.uid() (1 linha por usuário)
--   - O próprio usuário pode ler/atualizar/inserir o seu perfil

alter table public.profiles enable row level security;

-- Remove policies antigas (se existirem)
drop policy if exists "profile owner can read" on public.profiles;
drop policy if exists "profile owner can insert" on public.profiles;
drop policy if exists "profile owner can update" on public.profiles;

drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can insert own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;

-- SELECT: usuário lê o próprio perfil
create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
);

-- INSERT: usuário cria o próprio perfil (necessário para /onboarding)
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
);

-- UPDATE: usuário atualiza o próprio perfil
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

-- (Opcional) grants explícitos
grant select, insert, update on public.profiles to authenticated;
