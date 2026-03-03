-- Add UUIDv7-compatible generator and defaults for id columns that enforce UUIDv7 checks.

begin;

create or replace function public.uuid_v7_compat()
returns uuid
language plpgsql
volatile
as $$
declare
  ts_ms bigint;
  ts_hex text;
  rand_hex text;
  variant_byte int;
  variant_hex text;
  uuid_text text;
begin
  ts_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  ts_hex := lpad(to_hex(ts_ms), 12, '0');
  rand_hex := encode(gen_random_bytes(9), 'hex');

  variant_byte := (get_byte(gen_random_bytes(1), 0) & 63) | 128;
  variant_hex := lpad(to_hex(variant_byte), 2, '0');

  uuid_text :=
    substr(ts_hex, 1, 8) || '-' ||
    substr(ts_hex, 9, 4) || '-' ||
    '7' || substr(rand_hex, 1, 3) || '-' ||
    substr(variant_hex, 1, 1) || substr(rand_hex, 4, 3) || '-' ||
    substr(rand_hex, 7, 12);

  return uuid_text::uuid;
end;
$$;

alter table public.org_memberships alter column id set default public.uuid_v7_compat();
alter table public.credit_packages alter column id set default public.uuid_v7_compat();
alter table public.credit_ledger alter column id set default public.uuid_v7_compat();
alter table public.usage_outbox alter column id set default public.uuid_v7_compat();
alter table public.payment_webhook_receipts alter column id set default public.uuid_v7_compat();
alter table public.admin_audit_log alter column id set default public.uuid_v7_compat();

commit;
