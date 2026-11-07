#!/bin/sh
# Imports a dump of your Mac's database into the server database.
# Usage (on the server, in the deploy folder):   sh import-db.sh backups/marches.dump
set -e
cd "$(dirname "$0")"

DUMP="$1"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: sh import-db.sh backups/marches.dump"
  exit 1
fi
case "$DUMP" in
  backups/*) ;;
  *) echo "Put the dump file in the backups/ folder first."; exit 1 ;;
esac

DB=$(grep -E '^PGDATABASE=' .env | cut -d= -f2)
DB=${DB:-marches_publics}

echo "Importing $DUMP into database $DB ..."
# --clean --if-exists replaces tables that already exist (e.g. on a second import).
# --no-owner/--no-privileges: tables become owned by "postgres" here, so the
# read-only API user automatically gets SELECT on them.
docker compose exec -T db pg_restore -U postgres -d "$DB" \
  --clean --if-exists --no-owner --no-privileges "/$DUMP"

docker compose exec -T db psql -U postgres -d "$DB" \
  -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_reader;"

echo "Creating indexes ..."
docker compose run --rm --no-deps \
  -e PGUSER=postgres -e PGPASSWORD="$(grep -E '^POSTGRES_PASSWORD=' .env | cut -d= -f2-)" \
  api node src/createIndexes.js

echo "Done. Rows in tenders:"
docker compose exec -T db psql -U postgres -d "$DB" -tAc "SELECT count(*) FROM tenders;"
