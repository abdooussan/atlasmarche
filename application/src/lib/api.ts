import Constants from 'expo-constants';
import type { AuthResult, User, Attribution, Consultation, FetchFilesResult, Filters, Meta, Page, TenderFiles } from './types';

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
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
  }
}

// ---- Sign-in token (set by lib/auth.ts, which owns the account state) ----
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Called by lib/auth.ts: the token sent with every request, and what to do when the server rejects it. */
export function configureAuth(opts: { token: string | null; onUnauthorized?: () => void }) {
  authToken = opts.token;
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

async function get<T>(
  path: string,
  params?: Record<string, string | undefined>,
  base = `${API_URL}/api`,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const url = `${base}${path}${qs.size ? `?${qs}` : ''}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const sentToken = authToken;
    if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      // Session expired or closed elsewhere: back to the login screen.
      if (res.status === 401 && sentToken && !path.startsWith('/auth/')) onUnauthorized?.();
      throw new ApiError(err?.error ?? err?.message ?? `Erreur ${res.status}`, res.status, err?.code);
    }
    if (res.status === 204) return undefined as T;
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
  register: (name: string, email: string, password: string) =>
    get<AuthResult>('/auth/register', undefined, undefined, 'POST', { name, email, password }),
  login: (email: string, password: string) =>
    get<AuthResult>('/auth/login', undefined, undefined, 'POST', { email, password }),
  me: () => get<{ user: User }>('/auth/me'),
  logout: () => get<void>('/auth/logout', undefined, undefined, 'POST'),
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