import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useT, type TKey } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

type Mode = 'login' | 'register';
type Field = 'name' | 'email' | 'password';

type TextInputRef = React.ComponentRef<typeof TextInput>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First screen of the app: sign in, or create an account. Nothing else is reachable before. */
export default function LoginScreen() {
  const t = useT();
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: Field; key?: TKey; text?: string } | null>(null);

  const emailRef = useRef<TextInputRef>(null);
  const passwordRef = useRef<TextInputRef>(null);
  const isRegister = mode === 'register';

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    // Check on the phone first, so simple mistakes don't need the network.
    if (isRegister && !name.trim()) return setError({ field: 'name', key: 'auth.err.name' });
    if (!EMAIL_RE.test(email.trim())) return setError({ field: 'email', key: 'auth.err.email' });
    if (isRegister && password.length < 8) return setError({ field: 'password', key: 'auth.err.password' });
    if (!password) return setError({ field: 'password', key: 'auth.err.credentials' });

    setError(null);
    setBusy(true);
    try {
      if (isRegister) await register(name, email, password);
      else await login(email, password);
      // Signed in: app/_layout.tsx now shows the app instead of this screen.
    } catch (e) {
      setError(errorFor(e));
      setBusy(false);
    }
  };

  const errorText = error ? (error.key ? t(error.key) : error.text) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headRow}>
          <View style={styles.logo}>
            <Ionicons name="briefcase" size={26} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }} />
          <LanguageSwitch variant="onPrimary" />
        </View>
        <Text style={styles.portal}>{t('home.portal')}</Text>
        <Text style={styles.brand}>{t('home.brand')}</Text>
        <Text style={styles.subtitle}>{t(isRegister ? 'auth.subtitleRegister' : 'auth.subtitle')}</Text>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.segment} accessibilityRole="tablist">
              {(['login', 'register'] as const).map((m) => {
                const selected = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[styles.segmentItem, selected && styles.segmentItemOn]}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>
                      {t(m === 'login' ? 'auth.tabLogin' : 'auth.tabRegister')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isRegister ? (
              <Input
                label={t('auth.name')}
                value={name}
                onChangeText={setName}
                placeholder={t('auth.namePlaceholder')}
                invalid={error?.field === 'name'}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            ) : null}

            <Input
              ref={emailRef}
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              invalid={error?.field === 'email'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType={isRegister ? 'emailAddress' : 'username'}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <View style={styles.field}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <View style={[styles.inputRow, error?.field === 'password' && styles.inputInvalid]}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={isRegister ? t('auth.passwordHint') : undefined}
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  textContentType={isRegister ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  style={styles.inputFlex}
                  accessibilityLabel={t('auth.password')}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                  style={styles.eye}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {errorText ? (
              <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ busy, disabled: busy }}
              style={({ pressed }) => [styles.submit, (pressed || busy) && { opacity: 0.8 }]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>{t(isRegister ? 'auth.register' : 'auth.login')}</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => switchMode(isRegister ? 'login' : 'register')} hitSlop={8} style={styles.switch}>
            <Text style={styles.switchText}>{t(isRegister ? 'auth.haveAccount' : 'auth.noAccount')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Server/network error -> message in the user's language. */
function errorFor(e: unknown): { field?: Field; key?: TKey; text?: string } {
  if (!(e instanceof ApiError)) return { key: 'common.serverError' };
  if (e.status === 429) return { key: 'auth.err.tooMany' };
  switch (e.code) {
    case 'credentials': return { key: 'auth.err.credentials' };
    case 'email_taken': return { field: 'email', key: 'auth.err.emailTaken' };
    case 'email': return { field: 'email', key: 'auth.err.email' };
    case 'password': return { field: 'password', key: 'auth.err.password' };
    case 'name': return { field: 'name', key: 'auth.err.name' };
  }
  return e.status ? { text: e.message } : { key: 'common.serverError' };
}

type InputProps = React.ComponentProps<typeof TextInput> & { label: string; invalid?: boolean; ref?: React.Ref<TextInputRef> };

function Input({ label, invalid, ref, ...props }: InputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[styles.input, invalid && styles.inputInvalid]}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingBottom: 28 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 18 },
  logo: { width: 48, height: 48, marginTop: 12, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  portal: { color: '#FFFFFF', opacity: 0.9, fontSize: 13 },
  brand: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginTop: 2 },
  subtitle: { color: '#FFFFFF', opacity: 0.9, fontSize: 15, marginTop: 8, lineHeight: 21 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 18, gap: 16 },
  segment: { flexDirection: 'row', backgroundColor: colors.neutralSoft, borderRadius: radius.md, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segmentTextOn: { color: colors.primaryDark },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, color: colors.text, backgroundColor: colors.surface },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface },
  inputFlex: { flex: 1, minHeight: 46, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  inputInvalid: { borderColor: colors.danger },
  eye: { paddingHorizontal: 12, minHeight: 46, justifyContent: 'center' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FDECEA', borderRadius: radius.md, padding: 12 },
  errorText: { flex: 1, color: colors.danger, fontSize: 14, lineHeight: 20 },
  submit: { minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  switch: { alignSelf: 'center', paddingVertical: 6 },
  switchText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
