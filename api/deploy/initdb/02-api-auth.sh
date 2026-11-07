#!/bin/sh
# Runs once, when the database is created for the first time (after 01-api-reader.sh).
# Creates the account tables and "api_auth", the user the API writes accounts with.
# For a database that already exists, see DEPLOY.md, "Comptes utilisateurs".
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v auth_password="$AUTH_DB_PASSWORD" -f /docker-entrypoint-initdb.d/auth.sql.inc

echo "Created account tables and user api_auth"
