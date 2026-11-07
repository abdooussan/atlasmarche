#!/bin/sh
# Saves a compressed copy of the database in backups/ and keeps the last 14.
# Run it every night with cron (see DEPLOY.md).
set -e
cd "$(dirname "$0")"

DB=$(grep -E '^PGDATABASE=' .env | cut -d= -f2)
DB=${DB:-marches_publics}
FILE="backups/${DB}-$(date +%Y%m%d-%H%M).dump"

docker compose exec -T db pg_dump -U postgres -d "$DB" -Fc -f "/$FILE"
echo "Backup saved: $FILE"

ls -1t backups/"${DB}"-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
