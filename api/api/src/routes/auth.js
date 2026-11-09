import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../db.js';
import {
  bearerToken,
  createSession,
  deleteSession,
  hashPassword,
  publicUser,
  readDevice,
  requireUser,
  touchDevice,
  verifyPassword,
} from '../auth.js';

const router = Router();

// Slows down password guessing: 20 attempts per 15 minutes per IP address.
const attempts = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(v) {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function readPassword(v) {
  return typeof v === 'string' && v.length >= 8 && v.length <= 200 ? v : null;
}

// A hash computed once, so a login with an unknown email takes as long as one with a wrong password.
const dummyHash = hashPassword('not-a-real-password');

/** POST /api/auth/register  { name, email, password, device? } -> { token, user } */
router.post('/register', attempts, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = readEmail(req.body?.email);
  const password = readPassword(req.body?.password);
  if (!name || name.length > 120) return res.status(400).json({ error: 'Nom invalide', code: 'name' });
  if (!email) return res.status(400).json({ error: 'Adresse e-mail invalide', code: 'email' });
  if (!password) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères', code: 'password' });

  const hash = await hashPassword(password);
  let row;
  try {
    ({ rows: [row] } = await pool.query(
      `INSERT INTO app_users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email, name, hash],
    ));
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse', code: 'email_taken' });
    throw e;
  }
  const token = await createSession(row.id, readDevice(req.body?.device));
  res.status(201).json({ token, user: publicUser(row) });
});

/** POST /api/auth/login  { email, password, device? } -> { token, user } */
router.post('/login', attempts, async (req, res) => {
  const email = readEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const { rows: [row] } = email
    ? await pool.query('SELECT id, email, name, created_at, password_hash FROM app_users WHERE lower(email) = $1', [email])
    : { rows: [] };

  const ok = row ? await verifyPassword(password, row.password_hash) : (await verifyPassword(password, await dummyHash), false);
  if (!ok) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect', code: 'credentials' });

  const token = await createSession(row.id, readDevice(req.body?.device));
  res.json({ token, user: publicUser(row) });
});

/** GET /api/auth/me -> { user }   (401 when the token is missing, unknown or expired) */
router.get('/me', requireUser, async (req, res) => {
  await touchDevice(bearerToken(req));
  res.json({ user: req.user });
});

/** POST /api/auth/logout -> 204   (ends the session of this phone only) */
router.post('/logout', async (req, res) => {
  const token = bearerToken(req);
  if (token) await deleteSession(token);
  res.status(204).end();
});

export default router;
