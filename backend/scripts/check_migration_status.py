#!/usr/bin/env python3
"""Compare numbered SQL migrations with the database migration ledger.

Use:
  DATABASE_URL=postgresql://... python3 scripts/check_migration_status.py
  python3 scripts/check_migration_status.py --offline

Offline mode validates only the local filename sequence and explicitly reports
STATIC_ONLY. It never claims that database migrations are applied.
"""
import argparse
import os
import re
import sys
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent.parent / "supabase" / "sql"
MIGRATION_RE = re.compile(r"^(\d{4})_.+\.sql$")
LEDGER_VERSION_RE = re.compile(r"^\d{4}$")
# 0015 was deliberately retired with the obsolete one-open-position restriction.
RETIRED_SEQUENCE_NUMBERS = {15}


def expected_migrations():
    """Return numbered migration files as sorted (number, filename) pairs."""
    items = []
    for path in SQL_DIR.glob("*.sql"):
        match = MIGRATION_RE.match(path.name)
        if match:
            items.append((int(match.group(1)), path.name))
    return sorted(items)


def validate_expected(expected):
    if not expected:
        print("[STATUS] STATIC_CHECK_FAILED", file=sys.stderr)
        print("[FAIL] No numbered migration files found.", file=sys.stderr)
        return 2

    numbers = [number for number, _ in expected]
    gaps = [number for number in range(numbers[0], numbers[-1] + 1) if number not in numbers and number not in RETIRED_SEQUENCE_NUMBERS]
    duplicates = sorted(number for number in set(numbers) if numbers.count(number) > 1)

    print(f"Expected migrations: {len(expected)} ({numbers[0]:04d}..{numbers[-1]:04d})")
    for number, filename in expected:
        print(f"  {number:04d}  {filename}")
    if gaps or duplicates:
        print("[STATUS] STATIC_CHECK_FAILED", file=sys.stderr)
        if gaps:
            print(f"[FAIL] Missing sequence numbers: {gaps}", file=sys.stderr)
        if duplicates:
            print(f"[FAIL] Duplicate sequence numbers: {duplicates}", file=sys.stderr)
        return 2
    retired = sorted(number for number in RETIRED_SEQUENCE_NUMBERS if numbers[0] <= number <= numbers[-1] and number not in numbers)
    if retired:
        print(f"[INFO] Retired sequence numbers intentionally omitted: {retired}")
    print("[OK] Local migration filename sequence is valid.")
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true",
                        help="validate local migration filenames only; do not inspect database state")
    args = parser.parse_args()

    expected = expected_migrations()
    static_result = validate_expected(expected)
    if static_result:
        return static_result

    if args.offline:
        print("[STATUS] STATIC_ONLY")
        print("[INFO] Database migration state was not checked.")
        return 0

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("[STATUS] DATABASE_UNAVAILABLE", file=sys.stderr)
        print("[NOT VERIFIED] DATABASE_URL is not set; use --offline for an explicitly static check.", file=sys.stderr)
        return 2

    try:
        import psycopg2
    except ImportError:
        print("[STATUS] DATABASE_UNAVAILABLE", file=sys.stderr)
        print("[NOT VERIFIED] psycopg2 is not installed; install psycopg2-binary to inspect the database.", file=sys.stderr)
        return 2

    conn = None
    try:
        conn = psycopg2.connect(database_url)
        with conn.cursor() as cursor:
            cursor.execute("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version")
            applied_versions = [str(row[0]) for row in cursor.fetchall()]
    except Exception as error:
        print("[STATUS] DATABASE_UNAVAILABLE", file=sys.stderr)
        print(f"[NOT VERIFIED] Could not read the Supabase migration ledger: {error}", file=sys.stderr)
        return 2
    finally:
        if conn is not None:
            conn.close()

    # This repository names SQL files with four-digit sequence numbers, while
    # Supabase CLI ledgers commonly use 14-digit timestamps. Never compare the
    # two namespaces as if they were interchangeable.
    if any(not LEDGER_VERSION_RE.fullmatch(version) for version in applied_versions):
        print("[STATUS] VERSION_MAPPING_REQUIRED", file=sys.stderr)
        print("[NOT VERIFIED] Database ledger versions do not use the repository's four-digit numbering.", file=sys.stderr)
        print("[INFO] Reconcile migration history before reporting applied/missing migrations.", file=sys.stderr)
        return 2

    applied = set(applied_versions)
    missing = [f"{number:04d}" for number, _ in expected if f"{number:04d}" not in applied]
    if missing:
        print("[STATUS] MIGRATIONS_MISSING", file=sys.stderr)
        print(f"[FAIL] Migrations not recorded as applied: {missing}", file=sys.stderr)
        return 1

    print("[STATUS] SCHEMA_LEDGER_MATCHED")
    print("[OK] All numbered repository migrations are present in the matching ledger.")
    print("[INFO] This compares migration ledger versions only; it does not verify live schema objects.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
