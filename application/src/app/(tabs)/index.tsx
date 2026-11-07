import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsultationCard } from '@/components/ConsultationCard';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Card, EmptyState, ErrorState, Loading, SectionTitle } from '@/components/ui';
import { api } from '@/lib/api';
import { categoryLabel, useT } from '@/lib/i18n';
import { defaultFilters, useFilters } from '@/lib/store';
import { CATEGORIES, categoryStyle, colors, radius } from '@/lib/theme';
import type { Filters } from '@/lib/types';

export default function HomeScreen() {
  const t = useT();
  const setFilters = useFilters((s) => s.setFilters);
  const closing = useQuery({ queryKey: ['closing'], queryFn: () => api.closing(7, 5) });
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: 10 * 60_000 });

  /** Open the Consultations tab with a preset filter. */
  const openWith = (patch: Partial<Filters>) => {
    setFilters({ ...defaultFilters, ...patch });
    router.navigate('/consultations');
  };

  const refreshing = closing.isRefetching || meta.isRefetching;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{t('home.portal')}</Text>
            <Text style={styles.brand}>{t('home.brand')}</Text>
          </View>
          <LanguageSwitch variant="onPrimary" />
        </View>
        <Pressable
          style={styles.search}
          onPress={() => router.navigate('/consultations')}
          accessibilityRole="search"
          accessibilityLabel={t('home.searchLabel')}
        >
          <Ionicons name="search" size={20} color={colors.muted} />
          <Text style={styles.searchText}>{t('home.searchPlaceholder')}</Text>
        </Pressable>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { closing.refetch(); meta.refetch(); }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.section}>
          <SectionTitle>{t('home.byCategory')}</SectionTitle>
          <View style={styles.grid3}>
            {CATEGORIES.map((c) => {
              const s = categoryStyle[c];
              const count = meta.data?.ouvertesParCategorie[c];
              return (
                <Pressable
                  key={c}
                  onPress={() => openWith({ categories: [c] })}
                  style={({ pressed }) => [styles.catTile, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel(c)}${count != null ? `, ${t('home.openCount', { n: count })}` : ''}`}
                >
                  <View style={[styles.catIcon, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon} size={22} color={s.fg} />
                  </View>
                  <Text style={styles.catLabel}>{categoryLabel(c)}</Text>
                  {count != null ? <Text style={styles.catCount}>{t('home.openCount', { n: count })}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle
            action={
              <Pressable onPress={() => openWith({ sort: 'dateLimite' })} hitSlop={10}>
                <Text style={styles.link}>{t('home.seeAll')}</Text>
              </Pressable>
            }
          >
            {t('home.closingSoon')}
          </SectionTitle>
          {closing.isPending ? (
            <Loading />
          ) : closing.isError ? (
            <ErrorState message={closing.error.message} onRetry={() => closing.refetch()} />
          ) : closing.data.items.length === 0 ? (
            <EmptyState icon="calendar-outline" title={t('home.nothingClosing')} />
          ) : (
            closing.data.items.map((item) => <ConsultationCard key={item.id} item={item} compact />)
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('home.shortcuts')}</SectionTitle>
          <View style={styles.grid2}>
            <Shortcut title={t('home.sc.results')} subtitle={t('home.sc.resultsSub')} onPress={() => router.navigate('/attributions')} />
            {meta.data?.capabilities?.pme === false ? (
              <Shortcut title={t('home.sc.all')} subtitle={t('home.sc.allSub')} onPress={() => openWith({ statut: 'toutes' })} />
            ) : (
              <Shortcut title={t('home.sc.pme')} subtitle={t('home.sc.pmeSub')} onPress={() => openWith({ pme: true })} />
            )}
            <Shortcut title={t('home.sc.recent')} subtitle={t('home.sc.recentSub')} onPress={() => openWith({ sort: 'recent' })} />
            <Shortcut title={t('home.sc.favorites')} subtitle={t('home.sc.favoritesSub')} onPress={() => router.navigate('/favoris')} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Shortcut({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ flexBasis: '47%', flexGrow: 1, gap: 4 }}>
      <Text style={styles.scTitle}>{title}</Text>
      <Text style={styles.scSub}>{subtitle}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingBottom: 20, gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  hello: { color: '#FFFFFF', opacity: 0.9, fontSize: 13, marginTop: 12 },
  brand: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#FFFFFF' },
  searchText: { color: colors.muted, fontSize: 15 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  section: { gap: 12 },
  grid3: { flexDirection: 'row', gap: 10 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catTile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  catCount: { fontSize: 11, color: colors.muted },
  link: { fontSize: 14, fontWeight: '600', color: colors.primary },
  scTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  scSub: { fontSize: 12, color: colors.muted },
});
