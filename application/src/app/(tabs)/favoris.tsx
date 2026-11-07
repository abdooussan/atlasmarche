import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ConsultationCard } from '@/components/ConsultationCard';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { endOffset, useT } from '@/lib/i18n';
import { describeFilters, useFilters, useSaved, type SavedSearch } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function FavoritesScreen() {
  const t = useT();
  const favorites = useSaved((s) => s.favorites);
  const searches = useSaved((s) => s.searches);
  const removeSearch = useSaved((s) => s.removeSearch);
  const setFilters = useFilters((s) => s.setFilters);

  const list = Object.values(favorites).sort((a, b) => (a.dateLimite ?? '').localeCompare(b.dateLimite ?? ''));

  const openSearch = (s: SavedSearch) => {
    setFilters(s.filters);
    router.navigate('/consultations');
  };

  const confirmRemove = (s: SavedSearch) => {
    // Alert buttons don't exist in the browser: use the browser's own dialog there.
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('fav.deleteSearch')}\n${s.name}`)) removeSearch(s.id);
      return;
    }
    Alert.alert(t('fav.deleteSearch'), s.name, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeSearch(s.id) },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <SectionTitle>{t('fav.savedSearches')}</SectionTitle>
        {searches.length === 0 ? (
          <Text style={styles.hint}>{t('fav.savedHint')}</Text>
        ) : (
          searches.map((s) => (
            <View key={s.id}>
              <Card onPress={() => openSearch(s)} style={styles.searchCard}>
                <View style={styles.searchIcon}>
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2, paddingEnd: 36 }}>
                  <Text style={styles.searchName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.hint} numberOfLines={2}>{describeFilters(s.filters)}</Text>
                </View>
              </Card>
              {/* Outside the card: a button can't contain another button. */}
              <Pressable onPress={() => confirmRemove(s)} style={[styles.trash, endOffset(4)]} accessibilityRole="button" accessibilityLabel={t('fav.deleteSearch')}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle>{t('fav.followed')}</SectionTitle>
        {list.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title={t('fav.emptyTitle')}
            message={t('fav.emptyMsg')}
          />
        ) : (
          list.map((c) => <ConsultationCard key={c.id} item={c} />)
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle>{t('lang.title')}</SectionTitle>
        <LanguageSwitch />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 40 },
  section: { gap: 10 },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  trash: { position: 'absolute', top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  searchName: { fontSize: 14, fontWeight: '600', color: colors.text },
});
