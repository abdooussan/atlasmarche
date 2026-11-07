import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, ErrorState, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useT, type TKey } from '@/lib/i18n';
import { formatDate, formatMoney } from '@/lib/format';
import { colors } from '@/lib/theme';
import type { Attribution } from '@/lib/types';

type Tab = 'tous' | 'attribue' | 'infructueux';
const TABS: { value: Tab; label: TKey }[] = [
  { value: 'tous', label: 'attr.all' },
  { value: 'attribue', label: 'attr.won' },
  { value: 'infructueux', label: 'attr.failed' },
];

export default function AttributionsScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('attribue');
  const statut = tab === 'tous' ? undefined : tab;

  const query = useInfiniteQuery({
    queryKey: ['attributions', statut],
    queryFn: ({ pageParam }) => api.attributions(statut, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: 10 * 60_000 });
  const available = meta.data?.capabilities?.attributions !== false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab_) => {
          const on = tab_.value === tab;
          return (
            <Pressable
              key={tab_.value}
              onPress={() => setTab(tab_.value)}
              style={[styles.tab, on && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && { color: colors.primaryDark }]}>{t(tab_.label)}</Text>
            </Pressable>
          );
        })}
      </View>

      {query.isPending ? (
        <Loading />
      ) : query.isError && !items.length ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <AttributionCard a={item} />}
          contentContainerStyle={styles.list}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => query.refetch()}
          ListEmptyComponent={
            available ? (
              <EmptyState icon="ribbon-outline" title={t('attr.empty')} />
            ) : (
              <EmptyState
                icon="ribbon-outline"
                title={t('attr.soon')}
                message={t('attr.soonMsg')}
              />
            )
          }
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={{ margin: 16 }} color={colors.primary} /> : undefined}
        />
      )}
    </View>
  );
}

function AttributionCard({ a }: { a: Attribution }) {
  const t = useT();
  const won = a.statut === 'attribue';
  return (
    <Card>
      <View style={styles.row}>
        <Badge
          label={won ? t('attr.wonOne') : t('attr.failedOne')}
          bg={won ? colors.primarySoft : colors.neutralSoft}
          fg={won ? colors.primaryDark : '#3B463F'}
        />
        <Text style={styles.muted}>{t('common.ref', { ref: a.reference ?? '—' })}</Text>
      </View>
      <Text style={styles.title} numberOfLines={3}>{a.objet ?? t('common.noObject')}</Text>
      <Text style={styles.muted} numberOfLines={1}>
        {[a.acheteur, a.dateAttribution ? formatDate(a.dateAttribution) : null].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.amounts}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.small}>{t('attr.winner')}</Text>
          <Text style={styles.value}>{a.attributaire ?? '—'}</Text>
        </View>
        <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
          <Text style={styles.small}>{t('attr.amount')}</Text>
          <Text style={styles.value}>{formatMoney(a.montant)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {a.pvUrl ? (
          <Pressable style={styles.smallBtn} onPress={() => WebBrowser.openBrowserAsync(a.pvUrl as string)} accessibilityRole="link">
            <Text style={styles.smallBtnText}>{t('attr.pv')}</Text>
          </Pressable>
        ) : null}
        {a.nombreOffres != null ? (
          <View style={[styles.smallBtn, { borderColor: 'transparent', backgroundColor: colors.neutralSoft }]}>
            <Text style={styles.smallBtnText}>{t('attr.offers', { n: a.nombreOffres })}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.muted },
  amounts: { flexDirection: 'row', gap: 8, paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.divider },
  small: { fontSize: 11, fontWeight: '600', color: colors.muted },
  value: { fontSize: 14, fontWeight: '600', color: colors.text },
  smallBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontWeight: '500', color: colors.text },
});
