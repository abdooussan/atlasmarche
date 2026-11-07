// Prints the tables and columns of your database, plus one example row per table,
// so you can fill in src/fields.js. Read-only: it never changes anything.
import { close, connect, ident, query } from './db.js';

await connect();

const { rows: cols } = await query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position`);

const byTable = new Map();
for (const c of cols) {
  if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
  byTable.get(c.table_name).push(c);
}

if (!byTable.size) console.log('No tables found in the "public" schema.');

for (const [table, columns] of byTable) {
  const { rows: count } = await query(`SELECT count(*)::int AS n FROM ${ident(table)}`);
  console.log(`\n=== ${table} (${count[0].n} rows) ===`);
  for (const c of columns) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);

  const { rows: sample } = await query(`SELECT * FROM ${ident(table)} LIMIT 1`);
  if (sample[0]) {
    const short = Object.fromEntries(
      Object.entries(sample[0]).map(([k, v]) => [k, typeof v === 'string' && v.length > 80 ? `${v.slice(0, 80)}…` : v]),
    );
    console.log('  example row:', JSON.stringify(short, null, 2).replace(/\n/g, '\n  '));
  }
}

await close();
