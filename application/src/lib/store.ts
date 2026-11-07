import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { categoryLabel, t } from './i18n';
import type { Consultation, Filters } from './types';

export const defaultFilters: Filters = {
  q: '',
  categories: [],
  procedures: [],
  region: null,
  acheteur: '',
  statut: 'en_cours',
  pme: false,
  echeance: 'toutes',
  minEstimation: '',
  maxEstimation: '',
  sort: 'dateLimite',
};

/** Number of filters set beyond the defaults (shown as a badge). */
export function activeFilterCount(f: Filters): number {
  let n = 0;
  if (f.categories.length) n++;
  if (f.procedures.length) n++;
  if (f.region) n++;
  if (f.acheteur.trim()) n++;
  if (f.statut !== defaultFilters.statut) n++;
  if (f.pme) n++;
  if (f.echeance !== 'toutes') n++;
  if (f.minEstimation || f.maxEstimation) n++;
  return n;
}

// ---- Search filters (kept in memory for the session) ----
type FiltersState = {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
};

export const useFilters = create<FiltersState>()((set) => ({
  filters: defaultFilters,
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set((s) => ({ filters: { ...defaultFilters, q: s.filters.q } })),
}));

// ---- Favourites and saved searches (stored on the phone) ----
export type SavedSearch = { id: string; name: string; filters: Filters; createdAt: string };

type SavedState = {
  favorites: Record<string, Consultation>;
  searches: SavedSearch[];
  toggleFavorite: (c: Consultation) => void;
  isFavorite: (id: string) => boolean;
  saveSearch: (name: string, filters: Filters) => void;
  removeSearch: (id: string) => void;
};

export const useSaved = create<SavedState>()(
  persist(
    (set, get) => ({
      favorites: {},
      searches: [],
      toggleFavorite: (c) =>
        set((s) => {
          const next = { ...s.favorites };
          if (next[c.id]) delete next[c.id];
          else next[c.id] = c;
          return { favorites: next };
        }),
      isFavorite: (id) => Boolean(get().favorites[id]),
      saveSearch: (name, filters) =>
        set((s) => ({
          searches: [
            { id: String(Date.now()), name, filters, createdAt: new Date().toISOString() },
            ...s.searches,
          ].slice(0, 20),
        })),
      removeSearch: (id) => set((s) => ({ searches: s.searches.filter((x) => x.id !== id) })),
    }),
    {
      name: 'marches-saved',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ favorites: s.favorites, searches: s.searches }),
    },
  ),
);

/** Short human description of a filter set, e.g. "Travaux · Casablanca-Settat · « voirie »". */
export function describeFilters(f: Filters): string {
  const parts: string[] = [];
  if (f.categories.length) parts.push(f.categories.map(categoryLabel).join(', '));
  if (f.region) parts.push(f.region);
  if (f.procedures.length) parts.push(f.procedures.join(', '));
  if (f.pme) parts.push(t('common.pme'));
  if (f.q.trim()) parts.push(`« ${f.q.trim()} »`);
  return parts.join(' · ') || t('list.allConsultations');
}
