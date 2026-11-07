import { Router } from 'express';
import { query, tableNames, tables } from '../db.js';
import { CONSULTATION_FIELDS as F } from '../fields.js';
import { col } from '../sql.js';

const router = Router();

let cache = { at: 0, data: null };
const TTL = 10 * 60 * 1000; // 10 minutes

async function distinct(key) {
  const c = col(F, key);
  if (!c) return [];
  const { rows } = await query(
    `SELECT DISTINCT ${c}::text AS v FROM ${tables.consultations()}
     WHERE ${c} IS NOT NULL AND trim(${c}::text) <> '' ORDER BY 1 LIMIT 200`,
  );
  return rows.map((r) => r.v);
}

// GET /api/meta — values for the filter screen (regions, procedures)
// and open-tender counts per category for the home screen.
router.get('/', async (_req, res) => {
  if (cache.data && Date.now() - cache.at < TTL) return res.json(cache.data);

  const cat = col(F, 'categorie');
  const dl = col(F, 'dateLimite');
  const countsPromise =
    cat && dl
      ? query(
          `SELECT ${cat}::text AS categorie, count(*)::int AS n FROM ${tables.consultations()}
           WHERE ${dl} >= now() AND ${cat} IS NOT NULL GROUP BY 1`,
        )
      : Promise.resolve({ rows: [] });

  const [regions, procedures, counts] = await Promise.all([distinct('region'), distinct('procedure'), countsPromise]);

  const data = {
    regions,
    procedures,
    ouvertesParCategorie: Object.fromEntries(counts.rows.map((r) => [r.categorie, r.n])),
    // Tells the app which filters and sections the data supports, so it can hide the others.
    capabilities: {
      region: Boolean(F.region),
      pme: Boolean(F.reservePME),
      estimation: Boolean(F.estimation),
      attributions: Boolean(tableNames.attributions),
    },
  };
  cache = { at: Date.now(), data };
  res.json(data);
});

export default router;
