#!/usr/bin/env bash
# Aplica todas as migrações de supabase/migrations num PostgreSQL local descartável e roda
# supabase/tests/*.sql. Não usa nenhuma URL do Supabase nem dados reais.
# A autenticação do Supabase é simulada (auth.users, auth.uid(), auth.jwt()).
# Requer PostgreSQL (initdb/pg_ctl/psql) instalado. Uso: scripts/qa/run-sql-tests.sh [teste.sql ...]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
WORK="$(mktemp -d)"
PORT=55433
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
cleanup() { as_pg "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
[ "$(id -u)" = 0 ] && chown postgres "$WORK"

as_pg "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$WORK/data" -l "$WORK/log" -w \
  -o "-k $WORK -c listen_addresses='' -p $PORT" start >/dev/null
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)

"${PSQL[@]}" <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.jwt() returns jsonb language sql stable as
  $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
SQL

# pg_cron (agendador do Supabase) costuma não existir no PostgreSQL local: simula cron.schedule
# e ignora a linha "create extension ... pg_cron". O agendamento não roda nos testes.
HAS_CRON="$("${PSQL[@]}" -tAc "select count(*) from pg_available_extensions where name='pg_cron'")"
if [ "$HAS_CRON" = 0 ]; then
  "${PSQL[@]}" -c "create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';"
fi

for migration in "$ROOT"/supabase/migrations/*.sql; do
  sql="$migration"
  if [ "$HAS_CRON" = 0 ] && grep -qi 'create extension if not exists pg_cron' "$migration"; then
    sql="$WORK/$(basename "$migration")"; grep -vi 'create extension if not exists pg_cron' "$migration" >"$sql"
  fi
  if ! "${PSQL[@]}" -f "$sql" >"$WORK/out" 2>&1; then
    echo "FALHOU migração $(basename "$migration")"; cat "$WORK/out"; exit 1
  fi
done
echo "Migrações aplicadas: $(ls "$ROOT"/supabase/migrations/*.sql | wc -l)"

tests=("$@"); [ ${#tests[@]} -eq 0 ] && tests=("$ROOT"/supabase/tests/*.sql)
failed=0
for test in "${tests[@]}"; do
  if "${PSQL[@]}" -f "$test" >"$WORK/out" 2>&1; then echo "ok    $(basename "$test")"
  else echo "FALHOU $(basename "$test")"; sed 's/^/      /' "$WORK/out" | head -20; failed=$((failed+1)); fi
done
[ "$failed" -eq 0 ] && echo "Todos os testes SQL passaram." || { echo "$failed teste(s) SQL falharam."; exit 1; }
