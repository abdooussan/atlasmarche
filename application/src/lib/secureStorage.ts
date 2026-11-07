import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Login tokens are kept in the phone's encrypted storage (Keychain on iOS, Keystore on Android),
// not in AsyncStorage, which isn't encrypted. The web version has no secure storage: it uses localStorage.

const web = Platform.OS === 'web';

export async function getSecure(key: string): Promise<string | null> {
  try {
    if (web) return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecure(key: string, value: string): Promise<void> {
  try {
    if (web) localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Storage full or unavailable: the user stays logged in until the app is closed.
  }
}

export async function deleteSecure(key: string): Promise<void> {
  try {
    if (web) localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // nothing to do
  }
}
