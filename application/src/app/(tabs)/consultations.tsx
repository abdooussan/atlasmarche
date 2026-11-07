import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsultationCard } from '@/components/ConsultationCard';
import { Chip, EmptyState, ErrorState, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { categoryLabel, endOffset, useT, type TKey } from '@/lib/i18n';
import { activeFilterCount, describeFilters, useFilters, useSaved } from '@/lib/store';
import { colors } from '@/lib/theme';
import type { Sort } from '@/lib/types';

const SORT_LABELS: Record<Sort, TKey> = {
  dateLimite: 'list.sort.dateLimite',
  recent: 'list.sort.recent',
  estimation: 'list.sort.estimation',
};
const SORT_ORDER: Sort[] = ['dateLimite', 'recent', 'estimation'];

export default function ConsultationsScreen() {
  const t = useT();
  const filters = useFilters((s) => s.filters);
  const setFilters = useFilters((s) => s.setFilters);
  const saveSearch = useSaved((s) => s.saveSearch);

  // Debounce the search box so we don't call the API on every key press.
  const [text, setText] = useState(filters.q);
  useEffect(() => setText(filters.q), [filters.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== filters.q) setFilters({ q: text });
    }, 350);
    return () => clearTimeout(t);
  }, [text, filters.q, setFilters]);

  const query = useInfiniteQuery({
    queryKey: ['consultations', filters],
    queryFn: ({ pageParam }) => api.consultations(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total;
  const count = activeFilterCount(filters);

  const nextSort = () => {
    const i = SORT_ORDER.indexOf(filters.sort);
    setFilters({ sort: SORT_ORDER[(i + 1) % SORT_ORDER.length] });
  };

  const onSave = () => {
    saveSearch(describeFilters(filters), filters);
    if (Platform.OS === 'web') window.alert(`${t('list.savedTitle')}. ${t('list.savedMsg')}`);
    else Alert.alert(t('list.savedTitle'), t('list.savedMsg'));
  };

  const removable = [
    ...filters.categories.map((c) => ({ label: categoryLabel(c), remove: () => setFilters({ categories: filters.categories.filter((x) => x !== c) }) })),
    ...(filters.region ? [{ label: filters.region, remove: () => setFilters({ region: null }) }] : []),
    ...filters.procedures.map((p) => ({ label: p, remove: () => setFilters({ procedures: filters.procedures.filter((x) => x !== p) }) })),
    ...(filters.pme ? [{ label: t('common.pme'), remove: () => setFilters({ pme: false }) }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={colors.muted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.muted}
              style={styles.input}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessibilityLabel={t('list.search')}
            />
          </View>
          <Pressable
            style={styles.filterBtn}
            onPress={() => router.push('/filtres')}
            accessibilityRole="button"
            accessibilityLabel={count ? t('list.filtersActive', { n: count }) : t('screen.filters')}
          >
            <Ionicons name="options-outline" size={22} color="#FFFFFF" />
            {count ? (
              <View style={[styles.badge, endOffset(-4)]}>
                <Text style={styles.badgeText}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip
            label={t(`statut.${filters.statut}`)}
            selected
            onPress={() => router.push('/filtres')}
          />
          {removable.map((r) => (
            <Chip key={r.label} label={`${r.label}  ✕`} selected={false} onPress={r.remove} />
          ))}
        </ScrollView>
      </SafeAreaView>

      <View style={styles.toolbar}>
        <Text style={styles.total}>
          {total == null ? ' ' : t('list.total', { n: total })}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={onSave} hitSlop={8} style={styles.toolBtn} accessibilityRole="button">
            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            <Text style={styles.toolText}>{t('list.save')}</Text>
          </Pressable>
          <Pressable onPress={nextSort} hitSlop={8} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel={t('list.sortBy', { sort: t(SORT_LABELS[filters.sort]) })}>
            <Ionicons name="swap-vertical" size={16} color={colors.primary} />
            <Text style={styles.toolText}>{t(SORT_LABELS[filters.sort])}</Text>
          </Pressable>
        </View>
      </View>

      {query.isPending ? (
        <Loading />
      ) : query.isError && !items.length ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <ConsultationCard item={item} />}
          contentContainerStyle={styles.list}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <EmptyState icon="search-outline" title={t('list.emptyTitle')} message={t('list.emptyMsg')} />
          }
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 8 },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, fontSize: 15, color: colors.text, height: '100%' },
  filterBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  total: { fontSize: 13, color: colors.muted },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 6 },
  toolText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10, flexGrow: 1 },
});
