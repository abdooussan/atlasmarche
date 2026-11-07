import { router } from 'expo-router';
import { create } from 'zustand';
import { ApiError, authApi } from './api';
import { deleteSecure, getSecure, setSecure } from './secureStorage';
import type { AuthSession, User } from './types';

// Login state.
//
// - Free plan: no account needed. status is "guest" and everything public works as before.
// - Premium: the user logs in; user.isPaid comes from the API (is_paid in the database).
//
// The refresh token (60 days) is saved in secure storage, so the user stays logged in.
// The access token (15 minutes) only lives in memory and is renewed automatically.

const REFRESH_KEY = 'mp.refreshToken';
const USER_KEY = 'mp.user';

type Status = 'loading' | 'guest' | 'signedIn';

type AuthState = {
  status: Status;
  user: User | null;
};

export const useAuth = create<AuthState>()(() => ({ status: 'loading', user: null }));

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshing: Promise<void> | null = null;

async function saveSession(s: AuthSession) {
  accessToken = s.accessToken;
  refreshToken = s.refreshToken;
  useAuth.setState({ status: 'signedIn', user: s.user });
  await Promise.all([setSecure(REFRESH_KEY, s.refreshToken), setSecure(USER_KEY, JSON.stringify(s.user))]);
}

async function setUser(user: User) {
  useAuth.setState({ user });
  await setSecure(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  accessToken = null;
  refreshToken = null;
  useAuth.setState({ status: 'guest', user: null });
  await Promise.all([deleteSecure(REFRESH_KEY), deleteSecure(USER_KEY)]);
}

/** Gets a new access token. Only one runs at a time: each refresh token works once. */
function refreshSession(): Promise<void> {
  if (!refreshing) {
    refreshing = (async () => {
      if (!refreshToken) throw new ApiError('Connexion requise', 401, 'unauthorized');
      try {
        await saveSession(await authApi.refresh(refreshToken));
      } catch (e) {
        // Expired or revoked: log out. No network: keep the user and try again later.
        if (e instanceof ApiError && e.status === 401) await clearSession();
        throw e;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/**
 * Runs an API call that needs the logged-in user, adding the access token
 * and renewing it once if it has expired.
 *   const data = await withAuth((token) => request('/alertes', { token }));
 */
export async function withAuth<T>(call: (token: string) => Promise<T>): Promise<T> {
  if (!accessToken) await refreshSession();
  try {
    return await call(accessToken!);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code === 'bad_credentials') throw e;
    await refreshSession();
    return call(accessToken!);
  }
}

/** Called once at start-up (root layout). */
export async function initAuth() {
  const [savedToken, savedUser] = await Promise.all([getSecure(REFRESH_KEY), getSecure(USER_KEY)]);
  if (!savedToken) {
    useAuth.setState({ status: 'guest', user: null });
    return;
  }
  refreshToken = savedToken;
  let user: User | null = null;
  try {
    user = savedUser ? (JSON.parse(savedUser) as User) : null;
  } catch {
    user = null;
  }
  // Show the saved account straight away (works offline), then check it with the server.
  useAuth.setState({ status: user ? 'signedIn' : 'loading', user });
  try {
    await refreshSession();
  } catch {
    if (!user && useAuth.getState().status === 'loading') useAuth.setState({ status: 'guest' });
  }
}

let lastCheck = 0;
/** Reloads the account from the server (e.g. Premium just activated). Ignores errors. */
export async function refreshUser(force = false) {
  if (useAuth.getState().status !== 'signedIn') return;
  if (!force && Date.now() - lastCheck < 30_000) return;
  lastCheck = Date.now();
  try {
    const { user } = await withAuth((token) => authApi.me(token));
    await setUser(user);
  } catch {
    // offline or logged out: nothing else to do
  }
}

export async function login(email: string, password: string) {
  await saveSession(await authApi.login(email.trim(), password));
}

export async function register(data: { email: string; password: string; name: string; company?: string }) {
  await saveSession(await authApi.register({ ...data, email: data.email.trim(), name: data.name.trim() }));
}

export async function logout() {
  const token = refreshToken;
  await clearSession();
  if (token) authApi.logout(token).catch(() => {});
}

/** Records on the server that the user asked for Premium (the WhatsApp message is opened separately). */
export async function markPremiumRequested() {
  try {
    const { user } = await withAuth((token) => authApi.premiumRequest(token));
    await setUser(user);
  } catch {
    // Not important if it fails: the WhatsApp message is what counts.
  }
}

export async function deleteAccount(password: string) {
  await withAuth((token) => authApi.deleteAccount(token, password));
  await clearSession();
}

/** Premium is active for the logged-in user. */
export function usePremium(): boolean {
  return useAuth((s) => s.status === 'signedIn' && Boolean(s.user?.isPaid));
}

/**
 * For a Premium-only button. Returns true when the user can continue; otherwise
 * opens the login screen (guest) or the Premium screen (free account) and returns false.
 *   onPress={() => { if (requirePremium()) doPremiumThing(); }}
 */
export function requirePremium(): boolean {
  const { status, user } = useAuth.getState();
  if (status === 'signedIn' && user?.isPaid) return true;
  router.push(status === 'signedIn' ? '/premium' : '/connexion');
  return false;
}

/** Leaves the login flow: back where the user came from, or home. */
export function leaveAuth() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
