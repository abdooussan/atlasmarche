import { locale, t } from './i18n';

// Formatters for the current language (Morocco keeps Latin digits in Arabic too).
const cache = new Map<string, { date: Intl.DateTimeFormat; time: Intl.DateTimeFormat; money: Intl.NumberFormat }>();
function fmt() {
  const loc = locale();
  let f = cache.get(loc);
  if (!f) {
    const nu = { numberingSystem: 'latn' } as const;
    f = {
      date: new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit', year: 'numeric', ...nu }),
      time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, ...nu }),
      money: new Intl.NumberFormat(loc, { maximumFractionDigits: 0, ...nu }),
    };
    cache.set(loc, f);
  }
  return f;
}

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso?: string | null): string {
  const d = parse(iso);
  return d ? fmt().date.format(d) : '—';
}

export function formatDateTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return '—';
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? t('common.at', { date: fmt().date.format(d), time: fmt().time.format(d) }) : fmt().date.format(d);
}

/** True when a text has letters but none in lower case ("TRAVAUX DE VOIRIE"). */
function isAllCaps(s: string): boolean {
  return /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s);
}

/** "TRAVAUX D'AMÉNAGEMENT DE LA VOIRIE" -> "Travaux d'aménagement de la voirie". Mixed-case text is left as is. */
export function sentenceCase(s?: string | null): string {
  if (!s) return '';
  const t = s.trim();
  if (!isAllCaps(t)) return t;
  const lower = t.toLocaleLowerCase('fr');
  return lower.charAt(0).toLocaleUpperCase('fr') + lower.slice(1);
}

/** "LAAYOUNE" -> "Laayoune", "SIDI BENNOUR" -> "Sidi Bennour". Mixed-case text is left as is. */
export function titleCase(s?: string | null): string {
  if (!s) return '';
  const t = s.trim();
  if (!isAllCaps(t)) return t;
  return t
    .toLocaleLowerCase('fr')
    .replace(/(^|[\s\-'’(/,])(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('fr'));
}

export function formatMoney(value?: number | null): string {
  return value == null ? '—' : `${fmt().money.format(value)} ${t('common.currency')}`;
}

/** Short amount for cards: 1466160 -> "1,47 M MAD", 352000 -> "352 k MAD", 22000 -> "22 000 MAD".
 *  null when there is no amount. */
export function formatMoneyShort(value?: number | string | null): string | null {
  const v = value == null || value === '' ? NaN : Number(value);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace('.', ',').replace(/,?0+$/, '')} ${t('common.millions')}`;
  if (v >= 100_000) return `${Math.round(v / 1_000)} ${t('common.thousands')}`;
  return `${String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${t('common.currency')}`;
}

/** Whole days until the deadline (negative = already closed). */
export function daysLeft(iso?: string | null): number | null {
  const d = parse(iso);
  if (!d) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function deadlineLabel(iso?: string | null): { text: string; urgent: boolean; closed: boolean } {
  const n = daysLeft(iso);
  if (n == null) return { text: '—', urgent: false, closed: false };
  if (n < 0) return { text: t('common.closed'), urgent: false, closed: true };
  if (n === 0) return { text: t('common.today'), urgent: true, closed: false };
  return { text: t('common.daysLeft', { n }), urgent: n <= 5, closed: false };
}
