import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormError, formStyles, isEmail, SubmitButton, TextField } from '@/components/Form';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { openWhatsApp, passwordResetMessage } from '@/lib/whatsapp';

// No e-mail service on the server: a forgotten password is handled on WhatsApp.
// You reply with a temporary password made with:  npm run user -- reset client@mail.ma
export default function ForgotPasswordScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!isEmail(email)) return setError(t('err.invalidEmail'));
    setError(null);
    if (await openWhatsApp(passwordResetMessage(email.trim().toLowerCase()))) setSent(true);
    else setError(t('err.whatsapp'));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Ionicons name={sent ? 'chatbubble-ellipses-outline' : 'lock-closed-outline'} size={26} color={colors.primary} />
        </View>
        {sent ? (
          <>
            <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
              <Text style={formStyles.title} accessibilityRole="header">{t('auth.forgotSentTitle')}</Text>
              <Text style={formStyles.subtitle}>{t('auth.forgotSentMsg')}</Text>
            </View>
            <SubmitButton label={t('auth.backToLogin')} onPress={() => router.back()} />
            <SubmitButton label={t('premium.resend')} onPress={submit} variant="outline" />
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Text style={formStyles.title} accessibilityRole="header">{t('auth.forgotTitle')}</Text>
              <Text style={formStyles.subtitle}>{t('auth.forgotSubtitle')}</Text>
            </View>
            <View style={formStyles.form}>
              <FormError message={error} />
              <TextField
                label={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                onSubmitEditing={submit}
              />
              <SubmitButton label={t('auth.forgotSubmit')} onPress={submit} icon="logo-whatsapp" />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  icon: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
