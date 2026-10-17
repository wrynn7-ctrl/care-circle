#!/usr/bin/env bash
# Runs the database migrations and pgTAP tests.
#  - With Docker + Supabase CLI (CI, laptops): `supabase db reset` then `supabase test db`.
#  - Without Docker (e.g. a cloud sandbox): point DATABASE_URL at any PostgreSQL 15+ with pgTAP installed.
#    The script creates stand-ins for Supabase's auth schema/roles, applies migrations, runs the tests.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "▶ supabase db reset"
  npx supabase db reset --no-seed
  echo "▶ supabase test db"
  npx supabase test db
  exit 0
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "No Docker and no DATABASE_URL. Start Docker (then this script uses the Supabase CLI) or set" >&2
  echo "DATABASE_URL=postgres://user@host:port/db for a plain PostgreSQL with pgTAP installed." >&2
  exit 2
fi

echo "▶ plain-postgres mode"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/db-stub-auth.sql
for f in supabase/migrations/*.sql; do
  echo "  migration $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
fail=0
for t in supabase/tests/*.sql; do
  echo "  test $t"
  if out="$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X -t -A -f "$t" 2>&1)"; then
    echo "$out" | sed 's/^/    /'
    if echo "$out" | grep -qE '^not ok|^# Looks like'; then fail=1; fi
  else
    echo "$out" | sed 's/^/    /'; fail=1
  fi
done
exit $fail
