import { ident } from './db.js';

/** Column expression for an API field, or null if the table has no such column. */
export function col(fields, key) {
  const name = fields[key];
  return name ? ident(name) : null;
}

/** SELECT list that renames columns to the API names: "lieu_execution" AS "lieuExecution". */
export function selectList(fields, keys = Object.keys(fields)) {
  return keys
    .map((k) => {
      const c = col(fields, k);
      if (!c) return `NULL AS "${k}"`;
      return k === 'id' ? `${c}::text AS "id"` : `${c} AS "${k}"`;
    })
    .join(', ');
}

// Accent-insensitive comparison without needing the "unaccent" extension.
// Upper-case accented letters are included in case the database locale's lower() skips them.
const FROM = 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿÀÁÂÄÃÅÇÈÉÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝ';
const TO = 'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuy';
if (FROM.length !== TO.length) throw new Error('Accent map mismatch');

/** SQL expression: the column lower-cased with accents removed. */
export function folded(columnSql) {
  return `translate(lower(${columnSql}::text), '${FROM}', '${TO}')`;
}

/** User text -> LIKE pattern, lower-cased, accents removed, wildcards escaped. */
export function likePattern(text) {
  const clean = String(text)
    .trim()
    .slice(0, 100)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${clean}%`;
}

/** Collects WHERE conditions with numbered parameters ($1, $2, ...). */
export class Where {
  constructor() {
    this.parts = [];
    this.params = [];
  }

  /** Add a parameter and return its placeholder. */
  p(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  add(condition) {
    if (condition) this.parts.push(condition);
    return this;
  }

  toString() {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }
}
