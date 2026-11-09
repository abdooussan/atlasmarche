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

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO app_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, SESSION_DAYS],
  );
  // Housekeeping: forget this user's expired sessions.
  await pool.query('DELETE FROM app_sessions WHERE user_id = $1 AND expires_at < now()', [userId]);
  return token;
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
