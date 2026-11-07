#!/usr/bin/env bash
# One-time BTCBOX schema bootstrap for a fresh, empty PostgreSQL/Supabase database.
# This is NOT a legacy-data migration and does not write to any database unless
# the operator supplies both explicit confirmation variables.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$DIR/../supabase/sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[FAIL] DATABASE_URL is required." >&2
  exit 2
fi
if [ "${BTCBOX_BOOTSTRAP_CONFIRM:-}" != "YES" ]; then
  echo "[FAIL] Set BTCBOX_BOOTSTRAP_CONFIRM=YES after verifying the target is a new empty database." >&2
  exit 2
fi
# Parse the URL hostname; do not use substring matching that a remote URL
# could bypass by putting "localhost" in a query string or password.
IS_LOCAL_DB="$(python3 - "$DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlsplit

try:
    hostname = urlsplit(sys.argv[1]).hostname
except ValueError:
    hostname = None
print("1" if hostname in {"localhost", "127.0.0.1", "::1", "host.docker.internal"} else "0")
PY
)"
if [ "$IS_LOCAL_DB" != "1" ] && [ "${BTCBOX_ALLOW_REMOTE_BOOTSTRAP:-}" != "YES" ]; then
  echo "[FAIL] Remote database refused. Set BTCBOX_ALLOW_REMOTE_BOOTSTRAP=YES only after explicit owner approval." >&2
  exit 2
fi

# Only inspect BTCBOX-owned relations. Never print the connection string.
EXISTING="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  SELECT count(*)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND c.relkind IN ('r', 'p')
    AND (
      c.relname LIKE 'financial_%'
      OR c.relname LIKE 'seconds_%'
      OR c.relname LIKE 'admin_%'
      OR c.relname LIKE 'btcbox_%'
      OR c.relname IN ('deposit_records', 'withdrawal_requests', 'earn_products', 'earn_positions')
    );
")"
if [ "$EXISTING" != "0" ]; then
  echo "[FAIL] Found $EXISTING BTCBOX-owned tables. This bootstrap only runs against an empty BTCBOX schema; it will not overwrite or migrate existing data." >&2
  exit 3
fi

# Canonical operational schema only. Deliberately excluded:
# 0016 automated chain verification (not part of the manual-credit product),
# 0017-0019 legacy staging/import/reconciliation, and 0020 read-only diagnostics.
FILES=(
  0001_btcbox_state_cas.sql
  0002_financial_ledger_v1.sql
  0003_financial_lifecycle_v2.sql
  0004_financial_admin_adjustment_v1.sql
  0005_financial_earn_redemption_idempotency_v4.sql
  0006_financial_earn_policy_v5.sql
  0007_financial_admin_manual_deposit_v1.sql
  0008_financial_matching_engine_v1.sql
  0010_financial_read_api_v1.sql
  0011_financial_read_api_earn_v1.sql
  0012_financial_admin_read_api_v1.sql
  0013_financial_admin_account_read_api_v1.sql
  0014_financial_seconds_contracts_v1.sql
  0021_admin_audit_log_append_only_v1.sql
  0022_withdrawal_admin_review_status_v1.sql
  0023_btcbox_shared_rate_limit_v1.sql
  0024_seconds_settlement_idempotency_v1.sql
  0025_seconds_policy_versioning_v1.sql
  0026_admin_rbac_private_store_v1.sql
  0027_withdrawal_manual_payout_completion_v1.sql
  0028_admin_rbac_service_rpc_wrappers_v1.sql
  0029_withdrawal_fee_quote_idempotency_v1.sql
  0030_seconds_admin_open_positions_read_v1.sql
  0031_seconds_policy_duration_alignment_v1.sql
  0032_admin_audit_log_filter_indexes_v1.sql
  0033_withdrawal_legacy_rpc_cleanup_v1.sql
)

echo "[info] Bootstrapping a fresh BTCBOX schema with ${#FILES[@]} canonical SQL files."
for file in "${FILES[@]}"; do
  if [ ! -f "$SQL_DIR/$file" ]; then
    echo "[FAIL] Required bootstrap SQL file missing: $file" >&2
    exit 4
  fi
  echo "[apply] $file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_DIR/$file"
done

echo "[OK] BTCBOX empty-database bootstrap completed. Financial writes remain fail-closed until separately approved."
