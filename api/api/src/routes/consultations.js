import { Router } from 'express';
import { ident, query, tables } from '../db.js';
import { CONSULTATION_FIELDS as F, CONSULTATION_SEARCH_VECTOR, SEARCH_LANGUAGE } from '../fields.js';
import { col, folded, likePattern, selectList, Where } from '../sql.js';
import { list, pagination, toDate, toNumber } from '../utils.js';

const router = Router();

// Columns sent in list views (lighter than the full row).
const LIST_FIELDS = [
  'id', 'reference', 'objet', 'acheteur', 'lieuExecution', 'region', 'categorie',
  'procedure', 'dateLimite', 'reservePME', 'estimation', 'cautionProvisoire',
];

function orderBy(sort) {
  const id = col(F, 'id');
  const by = {
    dateLimite: col(F, 'dateLimite') && `${col(F, 'dateLimite')} ASC NULLS LAST`,
    recent: col(F, 'datePublication') && `${col(F, 'datePublication')} DESC NULLS LAST`,
    estimation: col(F, 'estimation') && `${col(F, 'estimation')} DESC NULLS LAST`,
  };
  const main = by[sort] ?? by.dateLimite;
  return `ORDER BY ${[main, `${id} ASC`].filter(Boolean).join(', ')}`;
}

/** Build the WHERE clause from query-string parameters. */
function buildWhere(q) {
  const w = new Where();

  if (q.q) {
    const pattern = w.p(likePattern(q.q));
    const searchable = ['objet', 'reference', 'acheteur', 'lieuExecution'].map((k) => col(F, k)).filter(Boolean);
    const conditions = searchable.map((c) => `${folded(c)} LIKE ${pattern}`);
    // Full-text match on the tsvector column finds word variants (e.g. "construction" ~ "constructions").
    if (CONSULTATION_SEARCH_VECTOR) {
      const lang = w.p(SEARCH_LANGUAGE);
      conditions.push(`${ident(CONSULTATION_SEARCH_VECTOR)} @@ websearch_to_tsquery(${lang}::regconfig, ${w.p(String(q.q).slice(0, 100))})`);
    }
    if (conditions.length) w.add(`(${conditions.join(' OR ')})`);
  }

  const categories = list(q.categorie);
  if (categories.length && col(F, 'categorie')) w.add(`${col(F, 'categorie')} = ANY(${w.p(categories)})`);

  const procedures = list(q.procedure);
  if (procedures.length && col(F, 'procedure')) w.add(`${col(F, 'procedure')} = ANY(${w.p(procedures)})`);

  if (q.region && col(F, 'region')) w.add(`${col(F, 'region')} = ${w.p(String(q.region))}`);

  if (q.acheteur && col(F, 'acheteur')) {
    w.add(`${folded(col(F, 'acheteur'))} LIKE ${w.p(likePattern(q.acheteur))}`);
  }

  if (q.pme === 'true' && col(F, 'reservePME')) w.add(`${col(F, 'reservePME')} IS TRUE`);

  // Status is derived from the deadline.
  const dl = col(F, 'dateLimite');
  if (dl) {
    if (q.statut === 'en_cours') w.add(`${dl} >= now()`);
    if (q.statut === 'cloturee') w.add(`${dl} < now()`);
    const from = toDate(q.dateFrom);
    const to = toDate(q.dateTo);
    if (from) w.add(`${dl} >= ${w.p(from)}`);
    if (to) {
      to.setHours(23, 59, 59, 999);
      w.add(`${dl} <= ${w.p(to)}`);
    }
  }

  const est = col(F, 'estimation');
  const min = toNumber(q.minEstimation);
  const max = toNumber(q.maxEstimation);
  if (est && min !== undefined) w.add(`${est} >= ${w.p(min)}`);
  if (est && max !== undefined) w.add(`${est} <= ${w.p(max)}`);

  return w;
}

// GET /api/consultations?q=&categorie=Travaux,Services&procedure=&region=&acheteur=
//   &statut=en_cours|cloturee&pme=true&dateFrom=&dateTo=&minEstimation=&maxEstimation=
//   &sort=dateLimite|recent|estimation&page=1&limit=20
router.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req.query);
  const w = buildWhere(req.query);
  const table = tables.consultations();

  const countSql = `SELECT count(*)::int AS total FROM ${table} ${w}`;
  const listParams = [...w.params, limit, offset];
  const listSql = `SELECT ${selectList(F, LIST_FIELDS)} FROM ${table} ${w} ${orderBy(req.query.sort)}
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;

  const [count, rows] = await Promise.all([query(countSql, w.params), query(listSql, listParams)]);
  const total = count.rows[0].total;

  res.json({ items: rows.rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/consultations/closing?days=7&limit=5 — open tenders closing soon.
router.get('/closing', async (req, res) => {
  const dl = col(F, 'dateLimite');
  if (!dl) return res.json({ items: [] });
  const days = Math.min(60, Math.max(1, toNumber(req.query.days) ?? 7));
  const limit = Math.min(20, Math.max(1, toNumber(req.query.limit) ?? 5));

  const { rows } = await query(
    `SELECT ${selectList(F, LIST_FIELDS)} FROM ${tables.consultations()}
     WHERE ${dl} >= now() AND ${dl} <= now() + make_interval(days => $1::int)
     ORDER BY ${dl} ASC LIMIT $2`,
    [days, limit],
  );
  res.json({ items: rows });
});

// GET /api/consultations/:id — full details.
router.get('/:id', async (req, res) => {
  const { rows } = await query(
    `SELECT ${selectList(F)} FROM ${tables.consultations()} WHERE ${col(F, 'id')}::text = $1 LIMIT 1`,
    [String(req.params.id)],
  );
  if (!rows.length) return res.status(404).json({ error: 'Consultation introuvable' });
  res.json(rows[0]);
});

export default router;
