import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from './db.js';

const scrypt = promisify(scryptCb);

/** How long a login stays valid on the phone. */
const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 90;

// ---- Passwords: scrypt with a random salt, stored as "scrypt$<salt>$<hash>" ----

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---- Sessions: the phone keeps a random token, the database keeps only its SHA-256 ----

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/**
 * Opens a session for this user. `device` ({ id, name, platform }, sent by the app) identifies the phone:
 * a phone keeps one session per account, and is recorded in app_devices to count the phones per email.
 */
export async function createSession(userId, device = null) {
  const token = randomBytes(32).toString('base64url');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (device) {
      // Signing in again on the same phone replaces its previous session.
      await client.query('DELETE FROM app_sessions WHERE user_id = $1 AND device_id = $2', [userId, device.id]);
      await client.query(
        `INSERT INTO app_devices (user_id, device_id, device_name, platform) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, device_id) DO UPDATE
           SET last_seen_at = now(),
               device_name = COALESCE(EXCLUDED.device_name, app_devices.device_name),
               platform = COALESCE(EXCLUDED.platform, app_devices.platform)`,
        [userId, device.id, device.name, device.platform],
      );
    }
    await client.query(
      `INSERT INTO app_sessions (token_hash, user_id, expires_at, device_id)
       VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
      [sha256(token), userId, SESSION_DAYS, device?.id ?? null],
    );
    // Housekeeping: forget this user's expired sessions.
    await client.query('DELETE FROM app_sessions WHERE user_id = $1 AND expires_at < now()', [userId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return token;
}

/** Marks the phone of this session as seen now (called when the app starts). */
export async function touchDevice(token) {
  await pool.query(
    `UPDATE app_devices d SET last_seen_at = now()
     FROM app_sessions s
     WHERE s.token_hash = $1 AND d.user_id = s.user_id AND d.device_id = s.device_id`,
    [sha256(token)],
  );
}

/** { id, name, platform } from the request body, or null. Only short plain strings are kept. */
export function readDevice(v) {
  const str = (x, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null);
  const id = str(v?.id, 100);
  if (!id) return null;
  return { id, name: str(v?.name, 120), platform: str(v?.platform, 20) };
}

export async function deleteSession(token) {
  await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [sha256(token)]);
}

/** The user that owns this token, or null if the token is unknown or expired. */
export async function userForToken(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.created_at
     FROM app_sessions s JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0] ? publicUser(rows[0]) : null;
}

export function publicUser(row) {
  return { id: String(row.id), email: row.email, name: row.name, createdAt: row.created_at };
}

/** "Authorization: Bearer <token>" -> token */
export function bearerToken(req) {
  const h = req.get('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Express middleware: answers 401 unless the request carries a valid token. Sets req.user. */
export async function requireUser(req, res, next) {
  const user = await userForToken(bearerToken(req));
  if (!user) return res.status(401).json({ error: 'Connexion requise' });
  req.user = user;
  next();
}
