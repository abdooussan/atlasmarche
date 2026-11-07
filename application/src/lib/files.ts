import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { ApiError, authApi, FILES_URL } from './api';
import { refreshUser, requirePremium, useAuth, withAuth } from './auth';
import { t } from './i18n';

// Tender documents are Premium only.
// files-api serves a file only with ?t=<token>; the API gives that token to Premium users,
// for one tender, valid 2 hours. Kept here so each tender asks once.

const cache = new Map<string, { token: string; until: number }>();

async function getFilesToken(tenderId: string): Promise<string> {
  const key = `${useAuth.getState().user?.id}:${tenderId}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const { token, expiresIn } = await withAuth((access) => authApi.filesToken(access, tenderId));
  cache.set(key, { token, until: Date.now() + expiresIn * 1000 });
  return token;
}

/** Adds the token to a files-api link. Other links (e.g. the portal) are returned unchanged. */
function signUrl(url: string, token: string): string {
  if (!url.startsWith(FILES_URL)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;
}

function showError(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(t('common.oops'), message);
}

/**
 * Runs a document action for Premium users only.
 * Guests go to the login screen, free accounts to the Premium screen.
 *   onPress={() => withDocuments(id, ({ sign }) => download(sign(url)))}
 */
export async function withDocuments(
  tenderId: string,
  action: (access: { sign: (url: string) => string; token: string }) => void,
) {
  if (!requirePremium()) return;
  try {
    const token = await getFilesToken(tenderId);
    action({ sign: (url) => signUrl(url, token), token });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'premium_required') {
      // Premium ended since the app last checked.
      await refreshUser(true);
      router.push('/premium');
      return;
    }
    showError(e instanceof ApiError ? e.message : t('err.generic'));
  }
}
