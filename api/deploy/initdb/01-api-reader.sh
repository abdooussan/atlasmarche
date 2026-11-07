#!/bin/sh
# Runs once, when the database is created for the first time.
# Creates "api_reader": the user the API connects with. It can only READ,
# so even a bug in the API could never change or delete your data.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v api_password="$API_DB_PASSWORD" -v db_name="$POSTGRES_DB" <<'EOSQL'
CREATE ROLE api_reader LOGIN PASSWORD :'api_password';
GRANT CONNECT ON DATABASE :"db_name" TO api_reader;
GRANT USAGE ON SCHEMA public TO api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO api_reader;
-- Tables created later by "postgres" (e.g. when you import your data) are readable too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO api_reader;
EOSQL

echo "Created read-only user api_reader"
