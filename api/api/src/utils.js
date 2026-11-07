/** "a,b,c" or ["a","b"] -> ["a","b","c"] (empty values removed). */
export function list(value) {
  if (value == null || value === '') return [];
  const arr = Array.isArray(value) ? value : String(value).split(',');
  return arr.map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

export function toNumber(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function toDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function pagination(query) {
  const page = Math.max(1, Math.floor(toNumber(query.page) ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(toNumber(query.limit) ?? 20)));
  return { page, limit, offset: (page - 1) * limit };
}
