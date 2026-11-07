import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Checkbox, errorText, FormError, formStyles, isEmail, isStrongPassword, SubmitButton, TextField, TextLink } from '@/components/Form';
import { register } from '@/lib/auth';
import { useT } from '@/lib/i18n';

export default function RegisterScreen() {
  const t = useT();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);

  const submit = async () => {
    setTried(true);
    if (!name.trim()) return setError(t('err.missingName'));
    if (!isEmail(email)) return setError(t('err.invalidEmail'));
    if (!isStrongPassword(password)) return setError(t('err.weakPassword'));
    if (!terms) return setError(t('err.terms'));
    setError(null);
    setLoading(true);
    try {
      await register({ name, company, email, password });
      router.replace('/premium'); // a new account is free: show how to activate Premium
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 6 }}>
          <Text style={formStyles.title} accessibilityRole="header">{t('auth.registerTitle')}</Text>
          <Text style={formStyles.subtitle}>{t('auth.registerSubtitle')}</Text>
        </View>

        <View style={formStyles.form}>
          <FormError message={error} />
          <TextField
            label={t('auth.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.namePlaceholder')}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            invalid={tried && !name.trim()}
          />
          <TextField
            label={t('auth.company')}
            labelHint={t('auth.optional')}
            value={company}
            onChangeText={setCompany}
            placeholder={t('auth.companyPlaceholder')}
            textContentType="organizationName"
          />
          <TextField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            invalid={tried && !isEmail(email)}
          />
          <TextField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.newPasswordPlaceholder')}
            password
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint={t('auth.passwordRule')}
            invalid={tried && !isStrongPassword(password)}
          />
          <Checkbox checked={terms} onChange={setTerms} label={t('auth.terms')} />
          <SubmitButton label={t('auth.submitRegister')} onPress={submit} loading={loading} />
        </View>

        <View style={formStyles.footer}>
          <Text style={formStyles.footerText}>{t('auth.haveAccount')}</Text>
          <TextLink label={t('auth.submitLogin')} onPress={() => router.replace('/connexion')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
