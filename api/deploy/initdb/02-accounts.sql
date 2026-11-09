-- User accounts for the mobile app.
--
-- New database: runs by itself the first time the "db" container starts (after 01-api-reader.sh).
-- Existing database (already on the server): run it once, from the deploy/ folder:
--   docker compose exec -T db psql -U postgres -d marches_publics < initdb/02-accounts.sql
-- Safe to run more than once.
--
-- The API still connects as "api_reader", which can only READ the tenders. On these two
-- tables only, it may also add, change and delete rows (create accounts, open/close sessions).

CREATE TABLE IF NOT EXISTS app_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,             -- scrypt, never the password itself
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_key ON app_users (lower(email));

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash   TEXT PRIMARY KEY,           -- SHA-256 of the token the phone keeps
  user_id      BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions (user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_reader') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app_users, app_sessions TO api_reader;
    GRANT USAGE, SELECT ON SEQUENCE app_users_id_seq TO api_reader;
  END IF;
END $$;
