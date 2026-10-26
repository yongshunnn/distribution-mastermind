#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the migrations (+ seed if present) and
# checks that anon and non-allowlisted users see nothing. Usage: npm run test:rls
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$(mktemp -d)"; PORT="${PGPORT_TEST:-54329}"
RUN_AS=""; if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; RUN_AS="sudo -u postgres"; command -v sudo >/dev/null || RUN_AS="su postgres -c"; fi
run() { if [ "$RUN_AS" = "su postgres -c" ]; then su postgres -c "$*"; elif [ -n "$RUN_AS" ]; then $RUN_AS "$@"; else "$@"; fi; }
run "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
run "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
trap 'run "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null; rm -rf "$DATA"' EXIT
sleep 1
PSQL="psql -h /tmp -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f "$ROOT/supabase/tests/local-stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; $PSQL -f "$f"; done
if [ -f "$ROOT/supabase/seed.sql" ]; then echo "seed: supabase/seed.sql"; $PSQL -f "$ROOT/supabase/seed.sql"; fi
$PSQL -f "$ROOT/supabase/tests/rls.sql"
echo "RLS OK"
