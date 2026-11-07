-- Account tables for the login and Premium features.
-- On a database that already exists (your server), run this ONCE as postgres:
--   docker compose exec -T db psql -U postgres -d marches_publics \
--     -v auth_password="$AUTH_DB_PASSWORD" < ../api/sql/auth.sql
-- (deploy/DEPLOY.md, section "Comptes utilisateurs", has the exact steps.)

CREATE TABLE IF NOT EXISTS app_users (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL DEFAULT '',
  company        TEXT NOT NULL DEFAULT '',
  is_paid        BOOLEAN NOT NULL DEFAULT false,
  paid_until     TIMESTAMPTZ,
  premium_requested_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_refresh_tokens_user_idx ON app_refresh_tokens (user_id);

-- "api_auth": the API's login for these two tables only. It can't change the tenders.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_auth') THEN
    CREATE ROLE api_auth LOGIN;
  END IF;
END $$;
ALTER ROLE api_auth PASSWORD :'auth_password';
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO api_auth', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO api_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_users, app_refresh_tokens TO api_auth;
GRANT USAGE, SELECT ON SEQUENCE app_users_id_seq, app_refresh_tokens_id_seq TO api_auth;
-- The read-only user must not see password hashes.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'api_reader') THEN
    REVOKE ALL ON app_users, app_refresh_tokens FROM api_reader;
  END IF;
END $$;
