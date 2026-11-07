import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { errorText, FormError, formStyles, isEmail, SubmitButton, TextField, TextLink } from '@/components/Form';
import { leaveAuth, login, useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function LoginScreen() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isEmail(email)) return setError(t('err.invalidEmail'));
    if (!password) return setError(t('err.badCredentials'));
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      // Premium already active: back to what the user was doing. Otherwise show how to get it.
      if (useAuth.getState().user?.isPaid) leaveAuth();
      else router.replace('/premium');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerRight: () => <TextLink label={t('auth.continueFree')} onPress={leaveAuth} /> }} />
      <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={formStyles.title} accessibilityRole="header">{t('auth.loginTitle')}</Text>
          <Text style={formStyles.subtitle}>{t('auth.loginSubtitle')}</Text>
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
            returnKeyType="next"
            invalid={Boolean(error) && !isEmail(email)}
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPlaceholder')}
            password
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            labelAction={<TextLink label={t('auth.forgot')} onPress={() => router.push({ pathname: '/mot-de-passe', params: { email } })} />}
          />
          <SubmitButton label={t('auth.submitLogin')} onPress={submit} loading={loading} />
        </View>

        <View style={formStyles.footer}>
          <Text style={formStyles.footerText}>{t('auth.noAccount')}</Text>
          <TextLink label={t('auth.createAccount')} onPress={() => router.replace('/inscription')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
