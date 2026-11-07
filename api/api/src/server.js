import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { connect, close, dropMissingColumns, tableNames } from './db.js';
import { CONSULTATION_FIELDS } from './fields.js';
import consultationsRouter from './routes/consultations.js';
import attributionsRouter from './routes/attributions.js';
import metaRouter from './routes/meta.js';
import { authRouter, meRouter } from './routes/auth.js';
import { closeAuth, ensureAuthTables } from './authDb.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const origins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : false }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/consultations', consultationsRouter);
app.use('/api/attributions', attributionsRouter);
app.use('/api/meta', metaRouter);
app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Express 5 forwards errors from async handlers here.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

const port = Number(process.env.PORT) || 4000;
await connect();
await dropMissingColumns(CONSULTATION_FIELDS, tableNames.consultations);
await ensureAuthTables();
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`API ready on http://localhost:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => Promise.all([close(), closeAuth()]).then(() => process.exit(0))));
}
