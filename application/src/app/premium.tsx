import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormError, formStyles, SubmitButton } from '@/components/Form';
import { markPremiumRequested, refreshUser, useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';
import { openWhatsApp, premiumRequestMessage } from '@/lib/whatsapp';

export default function PremiumScreen() {
  const t = useT();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Check the status each time the screen is shown and when the user comes back from WhatsApp.
  useFocusEffect(
    useCallback(() => {
      refreshUser(true);
      const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshUser(true));
      return () => sub.remove();
    }, []),
  );

  const request = async () => {
    if (!user) return;
    setError(null);
    if (!(await openWhatsApp(premiumRequestMessage(user)))) return setError(t('err.whatsapp'));
    markPremiumRequested();
  };

  const check = async () => {
    setChecking(true);
    await refreshUser(true);
    setChecking(false);
  };

  const perks = [t('premium.perk1'), t('premium.perk2'), t('premium.perk3')];

  return (
    <ScrollView contentContainerStyle={formStyles.screen}>
      <View style={{ gap: 8 }}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('premium.badge')}</Text>
        </View>
        <Text style={formStyles.title} accessibilityRole="header">
          {user?.isPaid ? t('premium.activeTitle') : t('premium.title')}
        </Text>
        <Text style={formStyles.subtitle}>{user?.isPaid ? t('premium.thanks') : t('premium.subtitle')}</Text>
      </View>

      <View style={styles.perks}>
        {perks.map((p) => (
          <View key={p} style={styles.perk}>
            <View style={styles.check}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <Text style={styles.perkText}>{p}</Text>
          </View>
        ))}
      </View>

      {status !== 'signedIn' || !user ? (
        // Opened without an account (e.g. from a Premium button).
        <View style={{ gap: 12 }}>
          <Text style={formStyles.subtitle}>{t('premium.loginFirst')}</Text>
          <SubmitButton label={t('auth.submitLogin')} onPress={() => router.replace('/connexion')} />
          <SubmitButton label={t('auth.createAccount')} onPress={() => router.replace('/inscription')} variant="outline" />
        </View>
      ) : user.isPaid ? (
        <View style={[styles.box, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.boxTitle, { color: colors.primaryDark }]}>{t('premium.activeTitle')}</Text>
            <Text style={[styles.boxText, { color: colors.primaryDark }]}>
              {user.paidUntil ? t('premium.activeUntil', { date: formatDate(user.paidUntil) }) : t('premium.activeNoEnd')}
            </Text>
          </View>
        </View>
      ) : user.premiumRequestedAt ? (
        <View style={{ gap: 12 }}>
          <View style={[styles.box, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
            <Ionicons name="time-outline" size={24} color={colors.warningDark} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.boxTitle, { color: colors.warningDark }]}>{t('premium.pendingTitle')}</Text>
              <Text style={[styles.boxText, { color: colors.warningDark }]}>{t('premium.pendingMsg')}</Text>
            </View>
          </View>
          <FormError message={error} />
          <SubmitButton label={t('premium.checkStatus')} onPress={check} loading={checking} icon="refresh-outline" />
          <SubmitButton label={t('premium.resend')} onPress={request} variant="outline" icon="logo-whatsapp" />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={styles.price}>{t('premium.priceNote')}</Text>
          <View style={styles.how}>
            <Text style={styles.howTitle}>{t('premium.howTitle')}</Text>
            <Text style={styles.howText}>{t('premium.step1')}</Text>
            <Text style={styles.howText}>{t('premium.step2')}</Text>
            <Text style={styles.howText}>{t('premium.step3')}</Text>
          </View>
          <FormError message={error} />
          <SubmitButton label={t('premium.request')} onPress={request} icon="logo-whatsapp" />
          <Text style={styles.signedIn}>{t('premium.signedInAs', { email: user.email })}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: colors.primaryDark },
  perks: { gap: 14, padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  perk: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
  price: { fontSize: 15, fontWeight: '600', color: colors.text },
  how: { gap: 4, padding: 14, borderRadius: radius.md + 2, backgroundColor: colors.neutralSoft },
  howTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  howText: { fontSize: 13, lineHeight: 19, color: '#3D4842' },
  box: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 16, borderRadius: radius.lg },
  boxTitle: { fontSize: 16, fontWeight: '700' },
  boxText: { fontSize: 14, lineHeight: 20 },
  signedIn: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
