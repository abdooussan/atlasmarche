import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { categoryLabel, useT } from '@/lib/i18n';
import { categoryStyle, colors, fallbackCategory, radius } from '@/lib/theme';

export function CategoryBadge({ categorie }: { categorie: string | null }) {
  useT();
  if (!categorie) return null;
  const s = categoryStyle[categorie] ?? fallbackCategory;
  return <Badge label={categoryLabel(categorie)} bg={s.bg} fg={s.fg} />;
}

export function Badge({ label, bg, fg, icon }: { label: string; bg: string; fg: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primaryDark, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{children}</Text>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, onPress, variant = 'solid', icon }: { label: string; onPress: () => void; variant?: 'solid' | 'outline'; icon?: keyof typeof Ionicons.glyphMap }) {
  const solid = variant === 'solid';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, solid ? styles.buttonSolid : styles.buttonOutline, pressed && { opacity: 0.8 }]}
    >
      {icon ? <Ionicons name={icon} size={18} color={solid ? '#FFFFFF' : colors.primary} /> : null}
      <Text style={[styles.buttonText, { color: solid ? '#FFFFFF' : colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.borderStrong} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyText}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title={t('common.oops')}
      message={message}
      action={<PrimaryButton label={t('common.retry')} onPress={onRetry} variant="outline" />}
    />
  );
}

export const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, justifyContent: 'center' },
  chipText: { fontSize: 14, color: colors.text },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  button: { flex: 1, minHeight: 52, borderRadius: radius.lg, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonSolid: { backgroundColor: colors.primary },
  buttonOutline: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  buttonText: { fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, minHeight: 240 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 6 },
});
