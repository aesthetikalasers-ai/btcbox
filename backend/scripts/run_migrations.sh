#!/usr/bin/env bash
# Backward-compatible entry point. New databases use the guarded one-time bootstrap.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "[info] run_migrations.sh is retained as a compatibility alias for the fresh empty-database bootstrap."
exec "$DIR/bootstrap-empty-database.sh"
