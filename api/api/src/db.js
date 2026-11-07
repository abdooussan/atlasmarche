import pg from 'pg';

// Return NUMERIC and BIGINT columns as JS numbers instead of strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8 / bigint
// Return DATE columns as "YYYY-MM-DD" so the day never shifts with time zones.
pg.types.setTypeParser(1082, (v) => v);

// Same settings as the Python script: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'marches_publics',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/** Quote a table or column name safely, e.g. lieu_execution -> "lieu_execution". */
export function ident(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(name)) {
    throw new Error(`Invalid table or column name: ${name}`);
  }
  return name.split('.').map((part) => `"${part}"`).join('.');
}

export const tableNames = {
  consultations: process.env.CONSULTATIONS_TABLE || 'tenders',
  // Leave ATTRIBUTIONS_TABLE empty in .env when there is no such table.
  attributions: process.env.ATTRIBUTIONS_TABLE ?? '',
};

export const tables = {
  consultations: () => ident(tableNames.consultations),
  /** null when no attributions table is configured. */
  attributions: () => (tableNames.attributions ? ident(tableNames.attributions) : null),
};

export async function connect() {
  const { rows } = await pool.query('SELECT current_database() AS db');
  console.log(`PostgreSQL connected (database "${rows[0].db}")`);
}

/**
 * Sets to null every mapped column that doesn't exist in `table`, so a column named in
 * fields.js before the scraper creates it can't make the queries fail.
 * Returns the API names that were disabled.
 */
export async function dropMissingColumns(fields, table) {
  if (!table) return [];
  const [schema, name] = table.includes('.') ? table.split('.') : [null, table];
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = $1 AND ($2::text IS NULL OR table_schema = $2)
       AND ($2::text IS NOT NULL OR table_schema = ANY(current_schemas(false)))`,
    [name, schema],
  );
  if (!rows.length) return []; // table not found or not visible: leave the mapping as it is
  const existing = new Set(rows.map((r) => r.column_name));
  const missing = [];
  for (const [key, column] of Object.entries(fields)) {
    if (column && !existing.has(column)) {
      fields[key] = null;
      missing.push(`${key} (${column})`);
    }
  }
  if (missing.length) console.warn(`Columns not found in "${table}", returned as null: ${missing.join(', ')}`);
  return missing;
}

export const query = (text, params) => pool.query(text, params);

export async function close() {
  await pool.end();
}
