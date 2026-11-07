import Constants from 'expo-constants';
import type { Attribution, Consultation, FetchFilesResult, Filters, Meta, Page, TenderFiles } from './types';

/**
 * API address. Set EXPO_PUBLIC_API_URL in mobile/.env, or "extra.apiUrl" in app.json.
 * On a phone, "localhost" is the phone itself: use your computer's local IP
 * (e.g. http://192.168.1.10:4000) during development, and your HTTPS domain in production.
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:4000'
).replace(/\/$/, '');

/**
 * Address of files-api (tender documents). By default the same domain as the API,
 * where Caddy sends /files/... to it. Set EXPO_PUBLIC_FILES_URL to use another address
 * (in development: http://localhost:4100).
 */
export const FILES_URL = (process.env.EXPO_PUBLIC_FILES_URL ?? API_URL).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function get<T>(
  path: string,
  params?: Record<string, string | undefined>,
  base = `${API_URL}/api`,
  method: 'GET' | 'POST' = 'GET',
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const url = `${base}${path}${qs.size ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { method, signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(body?.error ?? body?.message ?? `Erreur ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.');
  } finally {
    clearTimeout(timer);
  }
}

/** Convert the filter state into query-string parameters for the API. */
export function filtersToParams(f: Filters): Record<string, string | undefined> {
  let dateTo: string | undefined;
  if (f.echeance !== 'toutes') {
    const d = new Date();
    d.setDate(d.getDate() + (f.echeance === '7j' ? 7 : 30));
    dateTo = d.toISOString().slice(0, 10);
  }
  return {
    q: f.q.trim() || undefined,
    categorie: f.categories.join(',') || undefined,
    procedure: f.procedures.join(',') || undefined,
    region: f.region ?? undefined,
    acheteur: f.acheteur.trim() || undefined,
    statut: f.statut === 'toutes' ? undefined : f.statut,
    pme: f.pme ? 'true' : undefined,
    dateTo,
    minEstimation: f.minEstimation.replace(/\s/g, '') || undefined,
    maxEstimation: f.maxEstimation.replace(/\s/g, '') || undefined,
    sort: f.sort,
  };
}

export const api = {
  consultations: (f: Filters, page: number) =>
    get<Page<Consultation>>('/consultations', { ...filtersToParams(f), page: String(page), limit: '20' }),
  closing: (days = 7, limit = 5) =>
    get<{ items: Consultation[] }>('/consultations/closing', { days: String(days), limit: String(limit) }),
  consultation: (id: string) => get<Consultation>(`/consultations/${encodeURIComponent(id)}`),
  attributions: (statut: 'attribue' | 'infructueux' | undefined, page: number) =>
    get<Page<Attribution>>('/attributions', { statut, page: String(page), limit: '20' }),
  meta: () => get<Meta>('/meta'),
  files: (id: string) => get<TenderFiles>(`/files/${encodeURIComponent(id)}`, undefined, FILES_URL),
  /** Ask the server to download the tender's documents from the portal (runs in the background). */
  fetchFiles: (id: string) =>
    get<FetchFilesResult>(`/files/${encodeURIComponent(id)}/fetch`, undefined, FILES_URL, 'POST'),
};