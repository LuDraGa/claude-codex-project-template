#!/usr/bin/env sh
set -eu

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_DB_PASSWORD is required"
  exit 1
fi

PROJECT_REF_FILE="supabase/.temp/project-ref"
POOLER_FILE="supabase/.temp/pooler-url"

if [ ! -f "$PROJECT_REF_FILE" ] || [ ! -f "$POOLER_FILE" ]; then
  echo "Supabase link metadata not found. Run: supabase link --project-ref <ref>"
  exit 1
fi

PROJECT_REF=$(cat "$PROJECT_REF_FILE")
POOLER_HOST=$(sed -n 's#^postgresql://[^@]*@\([^:]*\):.*#\1#p' "$POOLER_FILE")

DB_HOST="${SUPABASE_DB_HOST:-$POOLER_HOST}"
DB_PORT="${SUPABASE_DB_PORT:-5432}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
DB_USER="${SUPABASE_DB_USER:-postgres.$PROJECT_REF}"

export PGPASSWORD="$SUPABASE_DB_PASSWORD"

psql "host=$DB_HOST port=$DB_PORT dbname=$DB_NAME user=$DB_USER sslmode=require" -X -v ON_ERROR_STOP=1 <<'SQL'
\echo '== migration versions =='
select version from supabase_migrations.schema_migrations order by version;

\echo '== rls enabled =='
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('org_memberships', 'org_wallet_settings', 'credit_ledger', 'credit_packages', 'admin_audit_log')
order by c.relname;

\echo '== policies =='
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('org_memberships', 'org_wallet_settings', 'credit_ledger', 'credit_packages', 'admin_audit_log')
order by tablename, policyname;

\echo '== idempotency indexes =='
select tablename, indexname
from pg_indexes
where schemaname='public'
  and tablename in ('credit_ledger','usage_outbox','payment_webhook_receipts')
  and (
    indexdef ilike '%idempotency_key%'
    or indexdef ilike '%provider_event_id%'
  )
order by tablename, indexname;
SQL
