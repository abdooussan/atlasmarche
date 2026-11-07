import { Router } from 'express';
import { query, tables } from '../db.js';
import { ATTRIBUTION_FIELDS as F } from '../fields.js';
import { col, folded, likePattern, selectList, Where } from '../sql.js';
import { list, pagination } from '../utils.js';

const router = Router();

// GET /api/attributions?statut=attribue|infructueux&q=&categorie=&page=1&limit=20
router.get('/', async (req, res) => {
  const { page, limit, offset } = pagination(req.query);
  const w = new Where();
  const table = tables.attributions();
  // No attributions table configured yet: return an empty list instead of an error.
  if (!table) return res.json({ items: [], total: 0, page, pages: 1 });

  if ((req.query.statut === 'attribue' || req.query.statut === 'infructueux') && col(F, 'statut')) {
    w.add(`${col(F, 'statut')} = ${w.p(req.query.statut)}`);
  }
  const categories = list(req.query.categorie);
  if (categories.length && col(F, 'categorie')) w.add(`${col(F, 'categorie')} = ANY(${w.p(categories)})`);
  if (req.query.q) {
    const pattern = w.p(likePattern(req.query.q));
    const searchable = ['objet', 'reference', 'acheteur', 'attributaire'].map((k) => col(F, k)).filter(Boolean);
    if (searchable.length) w.add(`(${searchable.map((c) => `${folded(c)} LIKE ${pattern}`).join(' OR ')})`);
  }

  const order = [col(F, 'dateAttribution') && `${col(F, 'dateAttribution')} DESC NULLS LAST`, `${col(F, 'id')} ASC`]
    .filter(Boolean)
    .join(', ');
  const listParams = [...w.params, limit, offset];

  const [count, rows] = await Promise.all([
    query(`SELECT count(*)::int AS total FROM ${table} ${w}`, w.params),
    query(
      `SELECT ${selectList(F)} FROM ${table} ${w} ORDER BY ${order}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    ),
  ]);
  const total = count.rows[0].total;

  res.json({ items: rows.rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

// GET /api/attributions/:id
router.get('/:id', async (req, res) => {
  if (!tables.attributions()) return res.status(404).json({ error: 'Attribution introuvable' });
  const { rows } = await query(
    `SELECT ${selectList(F)} FROM ${tables.attributions()} WHERE ${col(F, 'id')}::text = $1 LIMIT 1`,
    [String(req.params.id)],
  );
  if (!rows.length) return res.status(404).json({ error: 'Attribution introuvable' });
  res.json(rows[0]);
});

export default router;
