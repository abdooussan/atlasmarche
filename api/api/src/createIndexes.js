// Creates indexes that speed up the API's queries. Safe to run more than once.
// Only touches columns listed in src/fields.js; it never changes your data.
import { close, connect, ident, query, tableNames } from './db.js';
import { ATTRIBUTION_FIELDS as A, CONSULTATION_FIELDS as C, CONSULTATION_SEARCH_VECTOR } from './fields.js';

await connect();

const plan = [[tableNames.consultations, [C.dateLimite, C.datePublication, C.categorie, C.region], 'btree']];
if (CONSULTATION_SEARCH_VECTOR) plan.push([tableNames.consultations, [CONSULTATION_SEARCH_VECTOR], 'gin']);
if (tableNames.attributions) plan.push([tableNames.attributions, [A.dateAttribution, A.statut], 'btree']);

for (const [table, columns, method] of plan) {
  for (const column of columns.filter(Boolean)) {
    const name = `idx_${table}_${column}`.replace(/\W/g, '_').slice(0, 60);
    try {
      await query(`CREATE INDEX IF NOT EXISTS ${ident(name)} ON ${ident(table)} USING ${method} (${ident(column)})`);
      console.log(`✓ ${table}.${column}`);
    } catch (e) {
      console.log(`✗ ${table}.${column}: ${e.message}`);
    }
  }
}

await close();
