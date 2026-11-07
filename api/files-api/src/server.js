// files-api: serves the "Dossier de consultation" files saved on the server in
//   DCE_DIR/<id>/      (id = the tender's id in the database, e.g. /opt/marches/dce/3144)
//
// It is independent from the main API: no database, its own container. If it is
// down, the app still works and simply hides the download button.
//
//   GET /files/health              -> { ok: true }
//   GET /files/:id                 -> { id, count, zipUrl, files: [{ nom, taille, url }] }
//   GET /files/:id/zip             -> every file of the tender in one ZIP
//   GET /files/:id/:name           -> one file
//   POST /files/:id/fetch          -> asks dce-service to download the tender's DCE into DCE_DIR/<id>
//
// Premium only: opening or downloading a file, the ZIP, and "Récupérer le dossier" need ?t=<token>.
// The main API gives that token to Premium users (POST /api/me/files-token), signed with JWT_SECRET,
// valid 2 hours for one tender. The list (GET /files/:id) stays open so free users see what exists.
//
// When a tender has no files yet, GET /files/:id also returns `status` (and sometimes `message`)
// from dce-service: idle | pending | failed | none | unavailable. The app shows a
// "Récupérer le dossier" button for idle/failed and checks again while it is pending.
import crypto from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';

const DCE_DIR = path.resolve(process.env.DCE_DIR || '/data/dce');
const port = Number(process.env.PORT) || 4100;
// Internal address of dce-service (scraper/dce_service.py), e.g. http://dce:8090. Empty = no downloads.
const DCE_SERVICE_URL = (process.env.DCE_SERVICE_URL || '').replace(/\/$/, '');

/** Folder of a tender, or null when the id isn't a plain number (blocks "../" tricks). */
function folderOf(id) {
  const s = String(id ?? '');
  return /^\d{1,12}$/.test(s) ? path.join(DCE_DIR, s) : null;
}

/** Visible files directly in the tender's folder: [{ name, size }], sorted by name. [] if none. */
async function listFiles(id) {
  const dir = folderOf(id);
  if (!dir) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // no folder for this tender
  }
  const files = [];
  for (const e of entries) {
    if (!e.isFile() || e.name.startsWith('.')) continue;
    const { size } = await stat(path.join(dir, e.name));
    files.push({ name: e.name, size });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** "1,89 Mo", "350 Ko" */
function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2).replace('.', ',')} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

/** Calls dce-service. Returns { http, body }; on any problem { http: 503, body: { status: 'unavailable' } }. */
async function dceService(method, route, timeoutMs) {
  if (!DCE_SERVICE_URL) return { http: 503, body: { status: 'unavailable' } };
  try {
    const res = await fetch(`${DCE_SERVICE_URL}${route}`, { method, signal: AbortSignal.timeout(timeoutMs) });
    return { http: res.status, body: await res.json() };
  } catch (err) {
    console.warn(`dce-service ${method} ${route}:`, err.message);
    return { http: 503, body: { status: 'unavailable' } };
  }
}

// Same secret as the main API. Without it, every file request is refused.
const JWT_SECRET = process.env.JWT_SECRET || '';
if (JWT_SECRET.length < 32) console.warn('JWT_SECRET missing: documents can not be opened (Premium check).');

/** True when `token` is a document token from the main API for this tender, not expired. */
function validFilesToken(token, tenderId) {
  if (JWT_SECRET.length < 32 || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, payload, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return p.typ === 'files' && p.tid === String(tenderId) && typeof p.exp === 'number' && p.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function premiumOnly(req, res, next) {
  if (validFilesToken(req.query.t, req.params.id)) return next();
  res.status(403).json({ error: 'Documents réservés aux abonnés Premium', code: 'premium_required' });
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Caddy: use the real https address in the links

const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));
// The app checks every few seconds while a download is running, so allow a bit more than one call per second.
app.use('/files', rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false }));
// Each download opens a browser on the server: few per person.
const fetchLimit = rateLimit({ windowMs: 10 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { status: 'failed', message: 'Trop de demandes. Réessayez dans quelques minutes.' } });

app.get('/files/health', (_req, res) => res.json({ ok: true }));

// List of the tender's files (empty list when it has no folder).
app.get('/files/:id', async (req, res) => {
  if (!folderOf(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const files = await listFiles(req.params.id);
  const base = `${req.protocol}://${req.get('host')}/files/${req.params.id}`;
  // No files yet: say whether they can be downloaded, or are being downloaded.
  const extra = files.length ? { status: 'ready' } : (await dceService('GET', `/status/${req.params.id}`, 3000)).body;
  res.json({
    id: req.params.id,
    count: files.length,
    zipUrl: files.length ? `${base}/zip` : null,
    files: files.map((f) => ({ nom: f.name, taille: humanSize(f.size), url: `${base}/${encodeURIComponent(f.name)}` })),
    status: extra.status,
    ...(extra.message ? { message: extra.message } : {}),
  });
});

// The user asked for the documents: dce-service downloads them in the background into DCE_DIR/<id>.
app.post('/files/:id/fetch', premiumOnly, fetchLimit, async (req, res) => {
  if (!folderOf(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  if ((await listFiles(req.params.id)).length) return res.json({ status: 'ready' });
  const { http, body } = await dceService('POST', `/fetch/${req.params.id}`, 15000);
  if (body.status === 'unavailable' && !body.message) body.message = 'Service momentanément indisponible, réessayez plus tard.';
  res.status(http).json(body);
});

// The whole folder as one ZIP.
app.get('/files/:id/zip', premiumOnly, async (req, res) => {
  const files = await listFiles(req.params.id);
  if (!files.length) return res.status(404).json({ error: 'Aucun document pour cette consultation' });

  res.attachment(`DCE-${req.params.id}.zip`);
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('warning', (err) => console.warn('zip:', err.message));
  zip.on('error', (err) => {
    console.error('zip:', err);
    res.destroy(err); // headers already sent: cut the download
  });
  zip.pipe(res);
  const dir = folderOf(req.params.id);
  for (const f of files) zip.file(path.join(dir, f.name), { name: f.name });
  await zip.finalize();
});

// One file. Only names that really are in the folder are served.
app.get('/files/:id/:name', premiumOnly, async (req, res) => {
  const files = await listFiles(req.params.id);
  const file = files.find((f) => f.name === req.params.name);
  if (!file) return res.status(404).json({ error: 'Document introuvable' });
  res.download(file.name, file.name, { root: folderOf(req.params.id), dotfiles: 'deny' });
});

app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: 'Erreur serveur' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`files-api ready on http://localhost:${port} (folder ${DCE_DIR})`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
