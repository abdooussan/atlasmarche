import Constants from 'expo-constants';
import type { Attribution, AuthSession, Consultation, FetchFilesResult, Filters, Meta, Page, TenderFiles, User } from './types';

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
  /** `code` is the API's machine-readable reason, e.g. "bad_credentials", "premium_required". */
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, string | undefined>;
  body?: unknown;
  /** Access token, sent as "Authorization: Bearer ...". */
  token?: string | null;
  base?: string;
};

/** Low-level call to the API. Throws ApiError with the server's message, status and code. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, body, token, base = `${API_URL}/api` } = opts;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
  const url = `${base}${path}${qs.size ? `?${qs}` : ''}`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(data?.error ?? data?.message ?? `Erreur ${res.status}`, res.status, data?.code);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', undefined, 'network');
  } finally {
    clearTimeout(timer);
  }
}

function get<T>(
  path: string,
  params?: Record<string, string | undefined>,
  base = `${API_URL}/api`,
  method: 'GET' | 'POST' = 'GET',
): Promise<T> {
  return request<T>(path, { params, base, method });
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
  fetchFiles: (id: string, filesToken: string) =>
    get<FetchFilesResult>(`/files/${encodeURIComponent(id)}/fetch`, { t: filesToken }, FILES_URL, 'POST'),
};

/** Account endpoints. Calls that need the logged-in user go through auth.ts (it adds and refreshes the token). */
export const authApi = {
  register: (data: { email: string; password: string; name: string; company?: string }) =>
    request<AuthSession>('/auth/register', { method: 'POST', body: data }),
  login: (email: string, password: string) =>
    request<AuthSession>('/auth/login', { method: 'POST', body: { email, password } }),
  refresh: (refreshToken: string) => request<AuthSession>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (refreshToken: string) => request<{ ok: true }>('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: (token: string) => request<{ user: User }>('/me', { token }),
  /** Premium only: token that opens this tender's documents on files-api (valid 2 hours). */
  filesToken: (token: string, id: string) =>
    request<{ token: string; expiresIn: number }>('/me/files-token', { method: 'POST', token, body: { id } }),
  premiumRequest: (token: string) => request<{ user: User }>('/me/premium-request', { method: 'POST', token }),
  deleteAccount: (token: string, password: string) =>
    request<{ ok: true }>('/me', { method: 'DELETE', token, body: { password } }),
};
