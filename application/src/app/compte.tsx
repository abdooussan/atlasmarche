import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText, FormError, formStyles, SubmitButton, TextField } from '@/components/Form';
import { Card } from '@/components/ui';
import { deleteAccount, logout, useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { PlanBadge } from '@/components/AccountCard';

export default function AccountScreen() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    // Logged out (or account deleted) while this screen was open.
    return (
      <View style={formStyles.screen}>
        <SubmitButton label={t('account.login')} onPress={() => router.replace('/connexion')} />
      </View>
    );
  }

  const doLogout = () => {
    const go = async () => {
      await logout();
      router.back();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('account.logoutConfirm'))) go();
      return;
    }
    Alert.alert(t('account.logoutConfirm'), user.email, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.logout'), style: 'destructive', onPress: go },
    ]);
  };

  const doDelete = async () => {
    if (!password) return setError(t('err.badCredentials'));
    setError(null);
    setLoading(true);
    try {
      await deleteAccount(password);
      router.back();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={formStyles.screen} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 4 }}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.muted}>{user.email}</Text>
          {user.company ? <Text style={styles.muted}>{user.company}</Text> : null}
          <View style={styles.planRow}>
            <Text style={styles.label}>{t('account.plan')}</Text>
            <PlanBadge />
          </View>
        </Card>

        <SubmitButton
          label={user.isPaid ? t('screen.premium') : t('account.upgrade')}
          onPress={() => router.push('/premium')}
          icon="star-outline"
        />
        <SubmitButton label={t('account.logout')} onPress={doLogout} variant="outline" icon="log-out-outline" />

        <View style={{ gap: 12, marginTop: 16 }}>
          {deleting ? (
            <>
              <Text style={styles.muted}>{t('account.deleteMsg')}</Text>
              <FormError message={error} />
              <TextField
                label={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                password
                autoCapitalize="none"
                autoComplete="current-password"
              />
              <SubmitButton label={t('account.deleteConfirm')} onPress={doDelete} loading={loading} variant="danger" />
              <SubmitButton label={t('common.cancel')} onPress={() => setDeleting(false)} variant="outline" />
            </>
          ) : (
            <SubmitButton label={t('account.delete')} onPress={() => setDeleting(true)} variant="danger" icon="trash-outline" />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  muted: { fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
});
