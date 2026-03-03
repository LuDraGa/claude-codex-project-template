-- Phase 1 foundation: ledger, outbox, pricing packages, tenancy, RLS, and projections.
-- Canonical unit: credits_micros (BIGINT), where 1 credit = 1_000_000 credits_micros.

begin;

create extension if not exists pgcrypto;

create type public.credit_ledger_type as enum (
  'TOPUP',
  'DEBIT_LLM',
  'DEBIT_TOOL',
  'REFUND',
  'CHARGEBACK',
  'ADJUSTMENT'
);

create type public.usage_outbox_status as enum (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'SENT',
  'FAILED'
);

create type public.payment_webhook_status as enum (
  'RECEIVED',
  'VERIFIED',
  'PROCESSED',
  'REJECTED'
);

create type public.org_role as enum (
  'OWNER',
  'ADMIN',
  'MEMBER',
  'SUPPORT_READONLY_ADMIN'
);

create or replace function public.is_uuid_v7(value uuid)
returns boolean
language sql
immutable
as $$
  select substring(value::text from 15 for 1) = '7';
$$;

create or replace function public.jwt_active_org_id()
returns uuid
language plpgsql
stable
as $$
begin
  return (auth.jwt() ->> 'active_org_id')::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.org_memberships (
  id uuid primary key,
  org_id uuid not null,
  user_id uuid not null,
  role public.org_role not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id),
  constraint org_memberships_id_is_v7 check (public.is_uuid_v7(id))
);

create index org_memberships_user_id_idx on public.org_memberships (user_id);
create index org_memberships_org_id_idx on public.org_memberships (org_id);

create table public.org_wallet_settings (
  org_id uuid primary key,
  settlement_currency_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_wallet_settings_currency_upper check (settlement_currency_code = upper(settlement_currency_code)),
  constraint org_wallet_settings_currency_len check (char_length(settlement_currency_code) = 3)
);

create trigger org_wallet_settings_set_updated_at
before update on public.org_wallet_settings
for each row execute function public.set_updated_at();

create table public.credit_packages (
  id uuid primary key,
  code text not null unique,
  currency_code text not null,
  amount_minor bigint not null,
  credits_micros bigint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_packages_id_is_v7 check (public.is_uuid_v7(id)),
  constraint credit_packages_currency_upper check (currency_code = upper(currency_code)),
  constraint credit_packages_currency_len check (char_length(currency_code) = 3),
  constraint credit_packages_min_amount check (amount_minor >= 10000),
  constraint credit_packages_micros_positive check (credits_micros > 0)
);

create trigger credit_packages_set_updated_at
before update on public.credit_packages
for each row execute function public.set_updated_at();

create table public.credit_ledger (
  id uuid primary key,
  org_id uuid not null,
  user_id uuid,
  delta_micros bigint not null,
  type public.credit_ledger_type not null,
  idempotency_key text not null,
  run_id text,
  step_id text,
  trace_id text,
  rate_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key),
  constraint credit_ledger_id_is_v7 check (public.is_uuid_v7(id)),
  constraint credit_ledger_delta_non_zero check (delta_micros <> 0)
);

create index credit_ledger_org_created_idx on public.credit_ledger (org_id, created_at desc);
create index credit_ledger_run_step_idx on public.credit_ledger (org_id, run_id, step_id);
create index credit_ledger_trace_idx on public.credit_ledger (trace_id);

create table public.usage_outbox (
  id uuid primary key,
  event_type text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status public.usage_outbox_status not null default 'PENDING',
  attempts int not null default 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_outbox_id_is_v7 check (public.is_uuid_v7(id)),
  constraint usage_outbox_attempts_bounds check (attempts >= 0 and attempts <= 8)
);

create index usage_outbox_status_retry_idx on public.usage_outbox (status, next_retry_at, created_at);

create trigger usage_outbox_set_updated_at
before update on public.usage_outbox
for each row execute function public.set_updated_at();

create table public.payment_webhook_receipts (
  id uuid primary key,
  org_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  payload_hash text not null,
  status public.payment_webhook_status not null,
  created_at timestamptz not null default now(),
  unique (org_id, provider, provider_event_id),
  constraint payment_webhook_receipts_id_is_v7 check (public.is_uuid_v7(id))
);

create index payment_webhook_receipts_created_idx on public.payment_webhook_receipts (created_at desc);

create table public.lago_customers (
  org_id uuid primary key,
  lago_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger lago_customers_set_updated_at
before update on public.lago_customers
for each row execute function public.set_updated_at();

create table public.admin_audit_log (
  id uuid primary key,
  actor_user_id uuid not null,
  org_id uuid not null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_id_is_v7 check (public.is_uuid_v7(id))
);

create index admin_audit_log_org_created_idx on public.admin_audit_log (org_id, created_at desc);
create index admin_audit_log_actor_created_idx on public.admin_audit_log (actor_user_id, created_at desc);

create table public.credit_leases (
  org_id uuid primary key,
  lease_micros bigint not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint credit_leases_non_negative check (lease_micros >= 0)
);

create trigger credit_leases_set_updated_at
before update on public.credit_leases
for each row execute function public.set_updated_at();

-- Seed static v1 INR package catalog.
insert into public.credit_packages (
  id,
  code,
  currency_code,
  amount_minor,
  credits_micros,
  is_active
)
values
  ('01955f7a-0000-7000-8000-000000000199', 'INR_199', 'INR', 19900, 199000000, true),
  ('01955f7a-0000-7000-8000-000000000499', 'INR_499', 'INR', 49900, 525000000, true),
  ('01955f7a-0000-7000-8000-000000000999', 'INR_999', 'INR', 99900, 1100000000, true),
  ('01955f7a-0000-7000-8000-000000002499', 'INR_2499', 'INR', 249900, 2900000000, true)
on conflict (code) do update
set
  currency_code = excluded.currency_code,
  amount_minor = excluded.amount_minor,
  credits_micros = excluded.credits_micros,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.org_memberships enable row level security;
alter table public.org_wallet_settings enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.credit_packages enable row level security;
alter table public.admin_audit_log enable row level security;

create policy org_memberships_select_self
on public.org_memberships
for select
to authenticated
using (user_id = auth.uid());

create policy org_wallet_settings_select_active_org
on public.org_wallet_settings
for select
to authenticated
using (
  org_id = public.jwt_active_org_id()
  and exists (
    select 1
    from public.org_memberships m
    where m.org_id = org_wallet_settings.org_id
      and m.user_id = auth.uid()
  )
);

create policy credit_ledger_select_active_org
on public.credit_ledger
for select
to authenticated
using (
  org_id = public.jwt_active_org_id()
  and exists (
    select 1
    from public.org_memberships m
    where m.org_id = credit_ledger.org_id
      and m.user_id = auth.uid()
  )
);

create policy credit_packages_select_active_org_currency
on public.credit_packages
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.org_memberships m
    join public.org_wallet_settings ws
      on ws.org_id = m.org_id
    where m.org_id = public.jwt_active_org_id()
      and m.user_id = auth.uid()
      and ws.settlement_currency_code = credit_packages.currency_code
  )
);

create policy admin_audit_log_select_for_admin_roles
on public.admin_audit_log
for select
to authenticated
using (
  org_id = public.jwt_active_org_id()
  and exists (
    select 1
    from public.org_memberships m
    where m.org_id = admin_audit_log.org_id
      and m.user_id = auth.uid()
      and m.role in ('OWNER', 'ADMIN', 'SUPPORT_READONLY_ADMIN')
  )
);

create or replace view public.wallet_balance_view
with (security_invoker = true)
as
select
  org_id,
  coalesce(sum(delta_micros), 0)::bigint as balance_micros,
  max(created_at) as updated_at
from public.credit_ledger
group by org_id;

create or replace view public.usage_outbox_pending_view
with (security_invoker = true)
as
select
  id,
  event_type,
  payload,
  idempotency_key,
  status,
  attempts,
  next_retry_at,
  created_at,
  updated_at
from public.usage_outbox
where status in ('PENDING', 'RETRY')
  and (next_retry_at is null or next_retry_at <= now())
order by next_retry_at nulls first, created_at;

create or replace view public.org_active_package_view
with (security_invoker = true)
as
select
  p.id,
  p.code,
  p.currency_code,
  p.amount_minor,
  p.credits_micros,
  p.is_active,
  p.created_at,
  p.updated_at
from public.credit_packages p
join public.org_wallet_settings ws
  on ws.org_id = public.jwt_active_org_id()
 and ws.settlement_currency_code = p.currency_code
where p.is_active = true;

grant select on public.org_memberships to authenticated;
grant select on public.org_wallet_settings to authenticated;
grant select on public.credit_ledger to authenticated;
grant select on public.credit_packages to authenticated;
grant select on public.admin_audit_log to authenticated;
grant select on public.wallet_balance_view to authenticated;
grant select on public.org_active_package_view to authenticated;

-- Service role handles write paths; it also bypasses RLS.
grant all on public.org_memberships to service_role;
grant all on public.org_wallet_settings to service_role;
grant all on public.credit_ledger to service_role;
grant all on public.usage_outbox to service_role;
grant all on public.payment_webhook_receipts to service_role;
grant all on public.credit_packages to service_role;
grant all on public.lago_customers to service_role;
grant all on public.admin_audit_log to service_role;
grant all on public.credit_leases to service_role;
grant select on public.usage_outbox_pending_view to service_role;
grant select on public.wallet_balance_view to service_role;
grant select on public.org_active_package_view to service_role;

commit;
