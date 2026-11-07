import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { authQuery } from './authDb.js';

const scrypt = promisify(crypto.scrypt);

// ---- Settings ----
const ACCESS_TTL_SECONDS = 15 * 60; // access token: 15 minutes
export const REFRESH_TTL_DAYS = 60; // refresh token: 60 days, renewed each time it's used

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is missing or shorter than 32 characters (set it in .env)');
  return s;
}

// ---- Passwords (scrypt, built into Node) ----
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algo, saltB64, keyB64] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

/** Error text in French; the app shows its own translated message based on `code`. */
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (password.length > 200) return 'Mot de passe trop long.';
  if (!/\d/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre.';
  return null;
}

export function normalizeEmail(email) {
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254 ? e : null;
}

// ---- Access tokens (JWT, HS256) ----
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signAccessToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: String(userId), iat: now, exp: now + ACCESS_TTL_SECONDS }));
  const sig = crypto.createHmac('sha256', secret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Returns the user id, or null if the token is invalid or expired. */
export function verifyAccessToken(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(`${header}.${payload}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (h.alg !== 'HS256' || typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
    return p.sub ?? null;
  } catch {
    return null;
  }
}

// ---- Refresh tokens (random, stored hashed, one use each) ----
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await authQuery(
    `INSERT INTO app_refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, hashToken(token), REFRESH_TTL_DAYS],
  );
  return token;
}

export async function issueSession(userId) {
  return { accessToken: signAccessToken(userId), refreshToken: await issueRefreshToken(userId), expiresIn: ACCESS_TTL_SECONDS };
}

// ---- Users ----
export const USER_COLUMNS = `id, email, name, company, is_paid, paid_until, premium_requested_at, created_at,
  (is_paid AND (paid_until IS NULL OR paid_until > now())) AS premium`;

/** What the app receives about the logged-in user. */
export function publicUser(row) {
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    company: row.company,
    isPaid: Boolean(row.premium),
    paidUntil: row.paid_until,
    premiumRequestedAt: row.premium_requested_at,
    createdAt: row.created_at,
  };
}

export async function findUser(id) {
  const { rows } = await authQuery(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// ---- Middleware ----

/** Requires "Authorization: Bearer <accessToken>". Sets req.userId. */
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const userId = token && verifyAccessToken(token);
  if (!userId) return res.status(401).json({ error: 'Connexion requise', code: 'unauthorized' });
  req.userId = userId;
  next();
}

/**
 * For Premium-only routes: use after requireAuth.
 *   router.get('/alertes', requireAuth, requirePremium, handler)
 * Reads is_paid from the database on every call, so activating or ending
 * Premium takes effect at once.
 */
export async function requirePremium(req, res, next) {
  const user = await findUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Compte introuvable', code: 'unauthorized' });
  if (!user.premium) return res.status(403).json({ error: 'Abonnement Premium requis', code: 'premium_required' });
  req.user = user;
  next();
}
