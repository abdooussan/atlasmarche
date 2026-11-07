import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { deadlineLabel, formatDateTime, formatMoneyShort, sentenceCase, titleCase } from '@/lib/format';
import { endOffset, useT } from '@/lib/i18n';
import { useSaved } from '@/lib/store';
import { colors } from '@/lib/theme';
import type { Consultation } from '@/lib/types';
import { Badge, Card, CategoryBadge } from './ui';

function ConsultationCardBase({ item, compact = false }: { item: Consultation; compact?: boolean }) {
  const t = useT();
  const saved = useSaved((s) => Boolean(s.favorites[item.id]));
  const toggleFavorite = useSaved((s) => s.toggleFavorite);
  const dl = deadlineLabel(item.dateLimite);
  const estimation = formatMoneyShort(item.estimation);
  const caution = formatMoneyShort(item.cautionProvisoire);

  // The bookmark button sits on top of the card (not inside it): a button can't contain another button.
  return (
    <View>
      <Card onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: item.id } })}>
        <View style={styles.top}>
          <View style={styles.badges}>
            <CategoryBadge categorie={item.categorie} />
            {!compact && item.procedure ? <Text style={styles.proc}>{item.procedure}</Text> : null}
          </View>
          {compact ? (
            <Badge
              label={dl.text}
              icon="time-outline"
              bg={dl.urgent ? colors.warningSoft : colors.neutralSoft}
              fg={dl.urgent ? colors.warning : colors.muted}
            />
          ) : (
            <View style={styles.bookmarkSpace} />
          )}
        </View>

        <Text style={styles.title} numberOfLines={3}>{sentenceCase(item.objet) || t('common.noObject')}</Text>

        {compact ? (
          <Text style={styles.meta} numberOfLines={1}>
            {[sentenceCase(item.acheteur), titleCase(item.lieuExecution)].filter(Boolean).join(' · ')}
          </Text>
        ) : (
          <>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                {item.acheteur ? (
                  <View style={styles.row}>
                    <Ionicons name="business-outline" size={15} color={colors.muted} />
                    <Text style={styles.meta} numberOfLines={1}>{sentenceCase(item.acheteur)}</Text>
                  </View>
                ) : null}
                {item.lieuExecution || item.region ? (
                  <View style={styles.row}>
                    <Ionicons name="location-outline" size={15} color={colors.muted} />
                    <Text style={styles.meta} numberOfLines={1}>
                      {[titleCase(item.lieuExecution), item.region].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {estimation || caution ? (
                <View style={styles.amounts}>
                  {estimation ? (
                    <View style={styles.amount}>
                      <Text style={styles.amountLabel}>{t('card.estimation')}</Text>
                      <Text style={styles.amountValue}>{estimation}</Text>
                    </View>
                  ) : null}
                  {caution ? (
                    <View style={styles.amount}>
                      <Text style={styles.amountLabel}>{t('card.caution')}</Text>
                      <Text style={styles.amountValue}>{caution}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={styles.footer}>
              <Text style={styles.meta}>{t('common.ref', { ref: item.reference ?? '—' })}</Text>
              <Text style={[styles.deadline, dl.urgent && { color: colors.warning }, dl.closed && { color: colors.muted }]}>
                {dl.closed ? t('common.closed') : t('card.limit', { date: formatDateTime(item.dateLimite) })}
              </Text>
            </View>
          </>
        )}
      </Card>
      {compact ? null : (
        <Pressable
          onPress={() => toggleFavorite(item)}
          style={[styles.bookmark, endOffset(2)]}
          accessibilityRole="button"
          accessibilityLabel={saved ? t('common.removeFavorite') : t('common.addFavorite')}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? colors.primary : colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export const ConsultationCard = memo(ConsultationCardBase);

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  bookmarkSpace: { width: 22, height: 22 },
  bookmark: { position: 'absolute', top: 2, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  proc: { fontSize: 12, color: colors.muted },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoLeft: { flex: 1, gap: 8 },
  amounts: { alignItems: 'flex-end', gap: 6, maxWidth: '42%' },
  amount: { alignItems: 'flex-end' },
  amountLabel: { fontSize: 11, color: colors.muted },
  amountValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  meta: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.divider },
  deadline: { fontSize: 13, fontWeight: '600', color: colors.text },
});
