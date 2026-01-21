-- Stripe Billing (assinaturas) — tabelas e RLS
-- Correção para bancos onde public.profiles NÃO tem a coluna user_id.
-- Este projeto (código + scripts) assume profiles.user_id = auth.uid().

-- =========================================
-- 0) Garantir compatibilidade em public.profiles
-- =========================================
-- Se sua tabela profiles usa a coluna "id" como vínculo com auth.users(id),
-- este bloco cria profiles.user_id e copia os valores.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='user_id'
  ) then
    -- ok
    return;
  end if;

  -- Se não existe user_id, tentamos criar e popular a partir de profiles.id
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='id'
  ) then
    raise exception 'public.profiles precisa ter a coluna id (uuid) ou user_id (uuid)';
  end if;

  -- cria coluna user_id
  execute 'alter table public.profiles add column user_id uuid';
  -- popula (assumindo profiles.id = auth.users.id)
  execute 'update public.profiles set user_id = id where user_id is null';

  -- garante NOT NULL (se existir alguma linha sem id, isso vai falhar e é bom que falhe)
  execute 'alter table public.profiles alter column user_id set not null';

  -- índice único para permitir UPSERT onConflict=user_id
  execute 'create unique index if not exists profiles_user_id_key on public.profiles(user_id)';

  -- FK opcional (não quebra se já existir algo parecido)
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_user_id_fkey'
  ) then
    begin
      execute 'alter table public.profiles add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade';
    exception when others then
      -- Se já existir outra FK equivalente ou houver restrições do seu schema, seguimos sem travar.
      null;
    end;
  end if;
end $$;

-- =========================================
-- 1) billing_customers: user/school -> Stripe Customer
-- =========================================
create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Se a tabela já existia com outro formato, garantimos as colunas necessárias
alter table public.billing_customers
  add column if not exists user_id uuid,
  add column if not exists school_id uuid,
  add column if not exists stripe_customer_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists billing_customers_user_id_key on public.billing_customers(user_id);
create unique index if not exists billing_customers_stripe_customer_id_key on public.billing_customers(stripe_customer_id);
create index if not exists billing_customers_school_id_idx on public.billing_customers(school_id);

-- =========================================
-- 2) school_subscriptions: 1 assinatura por escola
-- =========================================
create table if not exists public.school_subscriptions (
  school_id uuid primary key references public.schools(id) on delete cascade,
  stripe_customer_id text null,
  stripe_subscription_id text null unique,
  status text null,
  price_id text null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean null default false,
  updated_at timestamptz not null default now()
);

alter table public.school_subscriptions
  add column if not exists school_id uuid,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists status text,
  add column if not exists price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists school_subscriptions_stripe_subscription_id_key
  on public.school_subscriptions(stripe_subscription_id);

-- =========================================
-- 3) RLS + Policies
-- =========================================

alter table public.billing_customers enable row level security;
alter table public.school_subscriptions enable row level security;

-- billing_customers: dono pode ler/insert/update

drop policy if exists "billing customers: owner read" on public.billing_customers;
drop policy if exists "billing customers: owner upsert" on public.billing_customers;
drop policy if exists "billing customers: owner update" on public.billing_customers;

create policy "billing customers: owner read"
on public.billing_customers
for select
to authenticated
using (user_id = auth.uid());

create policy "billing customers: owner upsert"
on public.billing_customers
for insert
to authenticated
with check (user_id = auth.uid());

create policy "billing customers: owner update"
on public.billing_customers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.billing_customers to authenticated;

-- school_subscriptions: membro da escola pode ler status

drop policy if exists "school subscriptions: members read" on public.school_subscriptions;

create policy "school subscriptions: members read"
on public.school_subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.school_id = school_subscriptions.school_id
  )
);

grant select on public.school_subscriptions to authenticated;

-- Inserts/updates em school_subscriptions devem ser feitos pelo backend com Service Role (webhook),
-- que bypassa RLS.
