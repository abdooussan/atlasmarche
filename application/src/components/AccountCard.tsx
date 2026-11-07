import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, PrimaryButton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useLang, useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';

/** "Gratuit", "Premium demandé" or "Premium" for the logged-in user. */
export function PlanBadge() {
  const t = useT();
  const user = useAuth((s) => s.user);
  if (user?.isPaid) return <Badge label={t('account.planPremium')} bg={colors.primarySoft} fg={colors.primaryDark} icon="star" />;
  if (user?.premiumRequestedAt) return <Badge label={t('account.planPending')} bg={colors.warningSoft} fg={colors.warningDark} icon="time-outline" />;
  return <Badge label={t('account.planFree')} bg={colors.neutralSoft} fg="#3B463F" />;
}

/** Top of the Favoris tab: log in / upgrade for guests, the account and plan for logged-in users. */
export function AccountCard() {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const rtl = useLang((s) => s.lang) === 'ar';

  if (status === 'loading') return null;

  if (status === 'guest' || !user) {
    return (
      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="star-outline" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{t('account.guestTitle')}</Text>
            <Text style={styles.text}>{t('account.guestMsg')}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <PrimaryButton label={t('account.login')} onPress={() => router.push('/connexion')} />
        </View>
      </Card>
    );
  }

  return (
    <Card onPress={() => router.push('/compte')} style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name="person-outline" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title} numberOfLines={1}>{user.name || user.email}</Text>
        <PlanBadge />
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} accessibilityLabel={t('account.open')} />
    </Card>
  );
}

/**
 * Accueil: "Abonnement Premium" banner for everyone who isn't Premium (no account, or free account).
 * Hidden once Premium is active. Opens the Premium screen, which asks guests to log in first.
 */
export function PremiumBanner() {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const rtl = useLang((s) => s.lang) === 'ar';

  if (status === 'loading' || user?.isPaid) return null;
  const pending = Boolean(user?.premiumRequestedAt);

  return (
    <Pressable
      onPress={() => router.push('/premium')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.bannerIcon}>
        <Ionicons name={pending ? 'time-outline' : 'star'} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.bannerTitle}>{pending ? t('account.planPending') : t('account.guestTitle')}</Text>
        <Text style={styles.bannerText}>{pending ? t('home.premiumPendingSub') : t('home.premiumSub')}</Text>
      </View>
      <View style={styles.bannerCta}>
        <Text style={styles.bannerCtaText}>{pending ? t('home.premiumFollow') : t('home.premiumCta')}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: colors.primaryDark },
  bannerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  bannerText: { fontSize: 13, lineHeight: 18, color: '#E3F0E9' },
  bannerCta: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36, paddingHorizontal: 10, borderRadius: 18, backgroundColor: '#FFFFFF' },
  bannerCtaText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  text: { fontSize: 13, lineHeight: 18, color: colors.muted },
});
