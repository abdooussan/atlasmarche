import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authPool, authQuery } from '../authDb.js';
import {
  FILES_TTL_SECONDS, USER_COLUMNS, checkPassword, findUser, hashPassword, hashToken, issueSession, normalizeEmail,
  publicUser, requireAuth, requirePremium, signFilesToken, verifyPassword,
} from '../auth.js';

// ---- /api/auth ----
export const authRouter = Router();

// Slows down password guessing: 10 attempts per 15 minutes per IP on login and sign-up.
const strict = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.', code: 'too_many' },
});

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// POST /api/auth/register  { email, password, name, company? }
authRouter.post('/register', strict, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Adresse e-mail invalide.', code: 'invalid_email' });
  const pwError = checkPassword(req.body?.password);
  if (pwError) return res.status(400).json({ error: pwError, code: 'weak_password' });
  const name = clean(req.body?.name, 120);
  if (!name) return res.status(400).json({ error: 'Indiquez votre nom.', code: 'missing_name' });

  const hash = await hashPassword(req.body.password);
  const { rows } = await authQuery(
    `INSERT INTO app_users (email, password_hash, name, company, last_login_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [email, hash, name, clean(req.body?.company, 160)],
  );
  if (!rows[0]) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse.', code: 'email_taken' });
  res.status(201).json({ user: publicUser(rows[0]), ...(await issueSession(rows[0].id)) });
});

// POST /api/auth/login  { email, password }
authRouter.post('/login', strict, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const { rows } = email
    ? await authQuery(`SELECT ${USER_COLUMNS}, password_hash FROM app_users WHERE email = $1`, [email])
    : { rows: [] };
  const user = rows[0];
  // Same answer for unknown e-mail and wrong password, so nobody can test which e-mails exist.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.', code: 'bad_credentials' });
  }
  await authQuery('UPDATE app_users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json({ user: publicUser(user), ...(await issueSession(user.id)) });
});

// POST /api/auth/refresh  { refreshToken }  -> new access + refresh token (the old one stops working)
authRouter.post('/refresh', async (req, res) => {
  const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  if (!token) return res.status(401).json({ error: 'Session expirée', code: 'unauthorized' });

  const client = await authPool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, user_id, expires_at, revoked_at FROM app_refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row || row.expires_at < new Date()) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Session expirée', code: 'unauthorized' });
    }
    if (row.revoked_at) {
      // A used token came back: it may have been stolen. Log this account out everywhere.
      await client.query('UPDATE app_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
      await client.query('COMMIT');
      return res.status(401).json({ error: 'Session expirée', code: 'unauthorized' });
    }
    await client.query('UPDATE app_refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
    await client.query('COMMIT');
    const user = await findUser(row.user_id);
    if (!user) return res.status(401).json({ error: 'Compte introuvable', code: 'unauthorized' });
    res.json({ user: publicUser(user), ...(await issueSession(user.id)) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
});

// POST /api/auth/logout  { refreshToken }
authRouter.post('/logout', async (req, res) => {
  const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  if (token) await authQuery('UPDATE app_refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)]);
  res.json({ ok: true });
});

// ---- /api/me (logged-in user) ----
export const meRouter = Router();
meRouter.use(requireAuth);

// GET /api/me — the app calls this at start-up and when it comes back to the screen,
// so Premium switches on as soon as you set is_paid = true.
meRouter.get('/', async (req, res) => {
  const user = await findUser(req.userId);
  if (!user) return res.status(401).json({ error: 'Compte introuvable', code: 'unauthorized' });
  res.json({ user: publicUser(user) });
});

// POST /api/me/premium-request — remembers that the user asked for Premium on WhatsApp.
meRouter.post('/premium-request', async (req, res) => {
  const { rows } = await authQuery(
    `UPDATE app_users SET premium_requested_at = now() WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [req.userId],
  );
  if (!rows[0]) return res.status(401).json({ error: 'Compte introuvable', code: 'unauthorized' });
  res.json({ user: publicUser(rows[0]) });
});

// POST /api/me/files-token  { id }  — Premium only. Token to add as ?t=... to a tender's document
// links on files-api (open, download, ZIP, "Récupérer le dossier"). Valid 2 hours, for that tender only.
meRouter.post('/files-token', requirePremium, (req, res) => {
  const id = String(req.body?.id ?? '');
  if (!/^\d{1,12}$/.test(id)) return res.status(400).json({ error: 'Identifiant invalide', code: 'invalid_id' });
  res.json({ token: signFilesToken(req.userId, id), expiresIn: FILES_TTL_SECONDS });
});

// DELETE /api/me  { password } — deletes the account (required by Apple and Google).
meRouter.delete('/', async (req, res) => {
  const { rows } = await authQuery('SELECT password_hash FROM app_users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.json({ ok: true });
  if (!(await verifyPassword(String(req.body?.password ?? ''), rows[0].password_hash))) {
    return res.status(401).json({ error: 'Mot de passe incorrect.', code: 'bad_credentials' });
  }
  await authQuery('DELETE FROM app_users WHERE id = $1', [req.userId]); // tokens go with it (ON DELETE CASCADE)
  res.json({ ok: true });
});
