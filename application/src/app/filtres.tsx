import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, PrimaryButton } from '@/components/ui';
import { api } from '@/lib/api';
import { categoryLabel, useT, type TKey } from '@/lib/i18n';
import { defaultFilters, useFilters } from '@/lib/store';
import { CATEGORIES, colors, radius } from '@/lib/theme';
import type { Echeance, Filters } from '@/lib/types';

const STATUTS: { value: Filters['statut']; label: TKey }[] = [
  { value: 'en_cours', label: 'statut.en_cours' },
  { value: 'cloturee', label: 'statut.cloturee' },
  { value: 'toutes', label: 'statut.toutes' },
];
const ECHEANCES: { value: Echeance; label: TKey }[] = [
  { value: 'toutes', label: 'filters.all' },
  { value: '7j', label: 'filters.next7' },
  { value: '30j', label: 'filters.next30' },
];

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export default function FiltersScreen() {
  const t = useT();
  const current = useFilters((s) => s.filters);
  const setFilters = useFilters((s) => s.setFilters);
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta, staleTime: 10 * 60_000 });

  // Edit a draft; nothing changes until the user taps "Afficher les résultats".
  const [draft, setDraft] = useState<Filters>(current);
  const patch = (p: Partial<Filters>) => setDraft((d) => ({ ...d, ...p }));

  // Hide filters the data doesn't support (unknown until /meta loads: show them).
  const caps = meta.data?.capabilities;
  const showEstimation = caps?.estimation ?? true;
  const showPme = caps?.pme ?? true;

  const apply = () => {
    setFilters(draft);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => setDraft({ ...defaultFilters, q: draft.q })} hitSlop={10} accessibilityRole="button">
              <Text style={styles.reset}>{t('filters.reset')}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label={t('filters.statut')}>
          <View style={styles.segment}>
            {STATUTS.map((s) => {
              const on = draft.statut === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => patch({ statut: s.value })}
                  style={[styles.segItem, on && styles.segItemOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{t(s.label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label={t('filters.category')}>
          <View style={styles.wrap}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={categoryLabel(c)} selected={draft.categories.includes(c)} onPress={() => patch({ categories: toggle(draft.categories, c) })} />
            ))}
          </View>
        </Field>

        {meta.data?.procedures.length ? (
          <Field label={t('filters.procedure')}>
            <View style={styles.wrap}>
              {meta.data.procedures.map((p) => (
                <Chip key={p} label={p} selected={draft.procedures.includes(p)} onPress={() => patch({ procedures: toggle(draft.procedures, p) })} />
              ))}
            </View>
          </Field>
        ) : null}

        {meta.data?.regions.length ? (
          <Field label={t('filters.region')}>
            <View style={styles.wrap}>
              <Chip label={t('filters.all')} selected={!draft.region} onPress={() => patch({ region: null })} />
              {meta.data.regions.map((r) => (
                <Chip key={r} label={r} selected={draft.region === r} onPress={() => patch({ region: draft.region === r ? null : r })} />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label={t('common.buyer')}>
          <TextInput
            value={draft.acheteur}
            onChangeText={(acheteur) => patch({ acheteur })}
            placeholder={t('filters.buyerPlaceholder')}
            placeholderTextColor={colors.muted}
            style={styles.input}
            accessibilityLabel={t('common.buyer')}
          />
        </Field>

        <Field label={t('filters.deadline')}>
          <View style={styles.wrap}>
            {ECHEANCES.map((e) => (
              <Chip key={e.value} label={t(e.label)} selected={draft.echeance === e.value} onPress={() => patch({ echeance: e.value })} />
            ))}
          </View>
        </Field>

        {showEstimation ? (
        <Field label={t('filters.estimation')}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={draft.minEstimation}
              onChangeText={(v) => patch({ minEstimation: v.replace(/[^\d]/g, '') })}
              placeholder={t('filters.min')}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1, minWidth: 0 }]}
              accessibilityLabel={t('filters.estMin')}
            />
            <TextInput
              value={draft.maxEstimation}
              onChangeText={(v) => patch({ maxEstimation: v.replace(/[^\d]/g, '') })}
              placeholder={t('filters.max')}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1, minWidth: 0 }]}
              accessibilityLabel={t('filters.estMax')}
            />
          </View>
        </Field>
        ) : null}

        {showPme ? (
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>{t('filters.pme')}</Text>
            <Text style={styles.help}>{t('filters.pmeHelp')}</Text>
          </View>
          <Switch
            value={draft.pme}
            onValueChange={(pme) => patch({ pme })}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor="#FFFFFF"
            accessibilityLabel={t('filters.pme')}
          />
        </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <PrimaryButton label={t('filters.apply')} onPress={apply} />
      </SafeAreaView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 32 },
  reset: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  help: { fontSize: 12, color: colors.muted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flexDirection: 'row', backgroundColor: colors.neutralSoft, borderRadius: 12, padding: 4 },
  segItem: { flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segTextOn: { color: colors.primaryDark },
  input: { height: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md + 2, paddingHorizontal: 12, fontSize: 15, color: colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
