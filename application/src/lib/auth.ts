// The user's account: who is signed in, and the token that proves it.
//
// - On a phone the token is kept in the secure keychain (expo-secure-store);
//   on the web, where that doesn't exist, in the browser storage.
// - The app shows only the login screen until `status` is 'signedIn' (see app/_layout.tsx).
// - If the server answers 401 (session expired or closed), the user is signed out.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { api, ApiError, configureAuth } from './api';
import type { AuthResult, User } from './types';

const TOKEN_KEY = 'marches-auth-token';
const USER_KEY = 'marches-auth-user';

const storage = {
  get: (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  remove: (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  /** Read the saved session when the app starts. */
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>()((set, get) => {
  /** Forget the session on this phone (the server is told separately, when possible). */
  const clear = async () => {
    configureAuth({ token: null });
    set({ status: 'signedOut', user: null });
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]).catch(() => {});
  };

  const start = async ({ token, user }: AuthResult) => {
    configureAuth({ token });
    set({ status: 'signedIn', user });
    await Promise.all([storage.set(TOKEN_KEY, token), storage.set(USER_KEY, JSON.stringify(user))]).catch(() => {});
  };

  configureAuth({
    token: null,
    onUnauthorized: () => {
      if (get().status === 'signedIn') void clear();
    },
  });

  return {
    status: 'loading',
    user: null,

    restore: async () => {
      let token: string | null = null;
      let user: User | null = null;
      try {
        token = await storage.get(TOKEN_KEY);
        const raw = await storage.get(USER_KEY);
        user = raw ? (JSON.parse(raw) as User) : null;
      } catch {
        token = null;
      }
      if (!token || !user) return clear();

      // Open the app at once with the saved account, then check it with the server.
      configureAuth({ token });
      set({ status: 'signedIn', user });
      try {
        const res = await api.me();
        set({ user: res.user });
        await storage.set(USER_KEY, JSON.stringify(res.user)).catch(() => {});
      } catch (e) {
        // 401: the session is no longer valid. Any other error (no network): stay signed in.
        if (e instanceof ApiError && e.status === 401) await clear();
      }
    },

    login: async (email, password) => start(await api.login(email.trim(), password)),

    register: async (name, email, password) => start(await api.register(name.trim(), email.trim(), password)),

    logout: async () => {
      await api.logout().catch(() => {}); // ends the session on the server; fine if offline
      await clear();
    },
  };
});
