import pg from 'pg';

// Accounts live in their own two tables. The API reads tenders with the read-only user
// (api_reader); accounts need writing, so they use a second user, "api_auth", that can
// only touch these two tables (created by deploy/initdb/02-api-auth.sh or sql/auth.sql).
//
// In development, leave AUTH_PGUSER empty: the same login as PGUSER is used.
export const authPool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.AUTH_PGUSER || process.env.PGUSER || 'postgres',
  password: process.env.AUTH_PGPASSWORD || process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'marches_publics',
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const authQuery = (text, params) => authPool.query(text, params);

/** Same SQL as sql/auth.sql. Runs at start-up; harmless when the tables already exist. */
const CREATE_SQL = `
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
`;

export async function ensureAuthTables() {
  try {
    await authPool.query(CREATE_SQL);
  } catch (e) {
    // api_auth may not be allowed to create tables: fine if they already exist.
    const { rows } = await authPool.query(`SELECT to_regclass('app_users') AS t`);
    if (!rows[0].t) {
      console.error('Account tables are missing and could not be created. Run sql/auth.sql as postgres (see deploy/DEPLOY.md).');
      throw e;
    }
  }
  console.log('Account tables ready');
}

export async function closeAuth() {
  await authPool.end();
}
