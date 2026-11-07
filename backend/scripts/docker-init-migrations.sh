#!/usr/bin/env bash
# Docker first-initialization hook: install the exact canonical BTCBOX operational schema.
# docker-entrypoint-initdb.d runs this only when the PostgreSQL data directory is empty.
# This is a fresh-database bootstrap, NOT an upgrade path for an existing volume.
set -euo pipefail

MIG_DIR="/docker-entrypoint-initdb.d/migrations"
if [ ! -d "$MIG_DIR" ]; then
  echo "[docker-init] migration directory is missing: $MIG_DIR" >&2
  exit 2
fi

EXISTING="$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -Atqc "
  SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')
    AND (c.relname LIKE 'financial_%' OR c.relname LIKE 'seconds_%' OR c.relname LIKE 'admin_%'
      OR c.relname LIKE 'btcbox_%' OR c.relname IN ('deposit_records','withdrawal_requests','earn_products','earn_positions'));
")"
if [ "$EXISTING" != "0" ]; then
  echo "[docker-init] refusing to bootstrap: BTCBOX-owned tables already exist." >&2
  exit 3
fi

# Keep this allowlist byte-for-byte aligned by filename with
# bootstrap-empty-database.sh and MIGRATION-ORDER-AND-CUTOVER.md.
# 0009 and 0015-0020 are retired/excluded sequence slots, not migrations.
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

for file in "${FILES[@]}"; do
  if [ ! -f "$MIG_DIR/$file" ]; then
    echo "[docker-init] required migration is missing: $file" >&2
    exit 4
  fi
  echo "[docker-init] applying $file"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$MIG_DIR/$file"
done

echo "[docker-init] canonical BTCBOX schema bootstrap completed."
