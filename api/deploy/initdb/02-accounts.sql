-- User accounts for the mobile app.
--
-- New database: runs by itself the first time the "db" container starts (after 01-api-reader.sh).
-- Existing database (already on the server): run it once, from the deploy/ folder:
--   docker compose exec -T db psql -U postgres -d marches_publics < initdb/02-accounts.sql
-- Safe to run more than once (run it again after updating: it adds what is missing).
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
-- Which phone opened the session (one session per phone and account).
ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Every phone that has ever signed in to an account. Kept after sign-out, so
-- "phones_total" counts all the phones an email has been used on.
CREATE TABLE IF NOT EXISTS app_devices (
  user_id        BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id      TEXT NOT NULL,             -- random id created by the app on first launch
  device_name    TEXT,                      -- e.g. "iPhone de Ahmed" (when the phone gives it)
  platform       TEXT,                      -- ios, android, web
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);

-- Number of phones per email:
--   SELECT * FROM app_user_phones ORDER BY phones_total DESC;
--   phones_total     = every phone that has signed in with this email
--   phones_signed_in = phones where the account is signed in right now
CREATE OR REPLACE VIEW app_user_phones AS
SELECT
  u.id AS user_id,
  u.email,
  u.name,
  count(d.device_id) AS phones_total,
  count(d.device_id) FILTER (WHERE EXISTS (
    SELECT 1 FROM app_sessions s
    WHERE s.user_id = d.user_id AND s.device_id = d.device_id AND s.expires_at > now()
  )) AS phones_signed_in,
  max(d.last_seen_at) AS last_seen_at
FROM app_users u
LEFT JOIN app_devices d ON d.user_id = u.id
GROUP BY u.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_reader') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON app_users, app_sessions, app_devices TO api_reader;
    GRANT SELECT ON app_user_phones TO api_reader;
    GRANT USAGE, SELECT ON SEQUENCE app_users_id_seq TO api_reader;
  END IF;
END $$;
