-- ClassFlow — Billing (Stripe)
-- Execute no Supabase (SQL Editor) no schema public.
--
-- Cria as tabelas usadas pelo fluxo /billing + webhooks do Stripe.
-- Se você já tiver essas tabelas, este script é idempotente.

-- =========================
-- 1) billing_customers
-- =========================
-- Mapeia (user_id, school_id) -> stripe_customer_id
create table if not exists public.billing_customers (
  user_id uuid primary key,
  school_id uuid not null,
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_customers_stripe_customer_id_uq
  on public.billing_customers (stripe_customer_id);

alter table public.billing_customers enable row level security;

-- O app grava/consulta este mapeamento com o cliente supabase do usuário.
-- Mantemos permissões restritas: cada usuário só vê/insere/atualiza a sua linha.
drop policy if exists "users can read own billing customer" on public.billing_customers;
create policy "users can read own billing customer"
on public.billing_customers
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can insert own billing customer" on public.billing_customers;
create policy "users can insert own billing customer"
on public.billing_customers
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own billing customer" on public.billing_customers;
create policy "users can update own billing customer"
on public.billing_customers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update on public.billing_customers to authenticated;


-- =========================
-- 2) school_subscriptions
-- =========================
-- Assinatura ativa é por ESCOLA (school_id) e vale para todos.
create table if not exists public.school_subscriptions (
  school_id uuid primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.school_subscriptions enable row level security;

-- Usuário autenticado pode ler a assinatura da sua escola (derivada de profiles).
drop policy if exists "school members can read subscription" on public.school_subscriptions;
create policy "school members can read subscription"
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


-- =========================
-- 3) user_access_overrides
-- =========================
-- Cortesia/override de acesso por usuário.
create table if not exists public.user_access_overrides (
  user_id uuid primary key,
  access_override text,
  access_override_until timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_access_overrides enable row level security;

drop policy if exists "users can read own override" on public.user_access_overrides;
create policy "users can read own override"
on public.user_access_overrides
for select
to authenticated
using (user_id = auth.uid());

grant select on public.user_access_overrides to authenticated;


-- =========================
-- 4) housekeeping (opcional)
-- =========================
-- Mantém updated_at atualizado automaticamente.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_billing_customers on public.billing_customers;
create trigger set_updated_at_billing_customers
before update on public.billing_customers
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_school_subscriptions on public.school_subscriptions;
create trigger set_updated_at_school_subscriptions
before update on public.school_subscriptions
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_user_access_overrides on public.user_access_overrides;
create trigger set_updated_at_user_access_overrides
before update on public.user_access_overrides
for each row execute function public.tg_set_updated_at();
