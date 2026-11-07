#!/usr/bin/env python3
"""Produce read-only evidence for reconciling Supabase timestamp migrations.

This tool NEVER applies SQL and NEVER edits the migration ledger. It emits:
- SHA-256 identities for the repository's canonical numbered SQL files;
- the hosted migration ledger versions (when readable);
- schema-only catalog fingerprints for tables, columns, constraints, indexes,
  functions, and schema/function privileges.

Database mode requires psycopg v3. The transaction is explicitly READ ONLY.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_DIR = ROOT / "supabase" / "sql"
MIGRATION_RE = re.compile(r"^(\d{4})_.+\.sql$")
RETIRED = {9, 15, 16, 17, 18, 19, 20}
PROTECTED_PROJECT = "zlozsutefnmgwwzrlipt"


def source_manifest():
    items = []
    for path in sorted(SQL_DIR.glob("*.sql")):
        match = MIGRATION_RE.match(path.name)
        if not match or int(match.group(1)) in RETIRED:
            continue
        payload = path.read_bytes()
        items.append({
            "sequence": int(match.group(1)),
            "filename": path.name,
            "sha256": hashlib.sha256(payload).hexdigest(),
            "bytes": len(payload),
        })
    return items


def query_all(cursor, sql, params=None):
    cursor.execute(sql, params or ())
    columns = [item.name for item in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def database_snapshot(database_url):
    # Prevent accidental use against the known production project. This is an
    # evidence collector for an isolated clone/staging database only.
    if PROTECTED_PROJECT in database_url:
        raise RuntimeError("Refusing the known production Supabase project; use an isolated staging clone.")

    try:
        import psycopg
    except ImportError as error:
        raise RuntimeError("psycopg v3 is required; install requirements-postgres-staging.txt.") from error

    snapshot = {"ledger": {"status": "UNREAD"}, "catalog": {}}
    with psycopg.connect(database_url, connect_timeout=8) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")
            cursor.execute("SELECT to_regclass('supabase_migrations.schema_migrations')")
            ledger_exists = cursor.fetchone()[0] is not None
            if ledger_exists:
                snapshot["ledger"] = {
                    "status": "READ",
                    "versions": [str(row[0]) for row in cursor.execute(
                        "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version"
                    ).fetchall()],
                }
            else:
                snapshot["ledger"] = {"status": "TABLE_NOT_FOUND", "versions": []}

            snapshot["catalog"]["schemas"] = query_all(cursor, """
                SELECT n.nspname AS schema_name,
                       has_schema_privilege('service_role', n.oid, 'USAGE') AS service_role_usage,
                       has_schema_privilege('anon', n.oid, 'USAGE') AS anon_usage,
                       has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_usage
                FROM pg_namespace n
                WHERE n.nspname IN ('public', 'private')
                ORDER BY n.nspname
            """)
            snapshot["catalog"]["relations"] = query_all(cursor, """
                SELECT n.nspname AS schema_name, c.relname AS object_name,
                       c.relkind AS object_kind, c.relrowsecurity AS rls_enabled,
                       c.relforcerowsecurity AS rls_forced
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname IN ('public', 'private')
                  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
                ORDER BY n.nspname, c.relname
            """)
            snapshot["catalog"]["columns"] = query_all(cursor, """
                SELECT table_schema, table_name, ordinal_position, column_name,
                       data_type, udt_name, is_nullable
                FROM information_schema.columns
                WHERE table_schema IN ('public', 'private')
                ORDER BY table_schema, table_name, ordinal_position
            """)
            snapshot["catalog"]["constraints"] = query_all(cursor, """
                SELECT n.nspname AS schema_name, c.relname AS table_name,
                       con.conname AS constraint_name, con.contype AS constraint_type,
                       pg_get_constraintdef(con.oid, true) AS definition
                FROM pg_constraint con
                JOIN pg_class c ON c.oid = con.conrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname IN ('public', 'private')
                ORDER BY n.nspname, c.relname, con.conname
            """)
            snapshot["catalog"]["indexes"] = query_all(cursor, """
                SELECT schemaname AS schema_name, tablename AS table_name,
                       indexname AS index_name, indexdef AS definition
                FROM pg_indexes
                WHERE schemaname IN ('public', 'private')
                ORDER BY schemaname, tablename, indexname
            """)
            snapshot["catalog"]["functions"] = query_all(cursor, """
                SELECT n.nspname AS schema_name, p.proname AS function_name,
                       p.oid::regprocedure::text AS signature,
                       pg_get_function_identity_arguments(p.oid) AS identity_arguments,
                       p.prosecdef AS security_definer, p.proconfig AS settings,
                       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
                       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
                       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
                FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname IN ('public', 'private')
                ORDER BY n.nspname, p.proname, p.oid::regprocedure::text
            """)
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-only", action="store_true",
                        help="emit the local migration SHA-256 manifest without connecting to a database")
    args = parser.parse_args()
    result = {
        "format": "btcbox-migration-reconciliation-evidence-v1",
        "mapping_status": "MANUAL_REVIEW_REQUIRED",
        "source_migrations": source_manifest(),
    }
    if args.source_only:
        result["database"] = {"status": "NOT_CHECKED"}
    else:
        database_url = os.environ.get("STAGING_DATABASE_URL", "").strip()
        if not database_url:
            print("[NOT VERIFIED] Set STAGING_DATABASE_URL to an isolated staging clone; production DATABASE_URL is intentionally ignored.", file=sys.stderr)
            return 2
        try:
            result["database"] = database_snapshot(database_url)
        except Exception as error:
            # Do not echo connection details, which may contain credentials.
            print(f"[AUDIT FAILED] {type(error).__name__}: {error}", file=sys.stderr)
            return 2
    print(json.dumps(result, indent=2, sort_keys=True, default=str))
    print("[STATUS] MANUAL_REVIEW_REQUIRED", file=sys.stderr)
    print("[INFO] This report is evidence only; it does not map timestamps or execute migrations.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
