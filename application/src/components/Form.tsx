import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { ApiError } from '@/lib/api';
import { t, useT, type TKey } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

/** Translated message for an error thrown by the API client. */
export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return t('err.generic');
  const byCode: Record<string, TKey> = {
    invalid_email: 'err.invalidEmail',
    weak_password: 'err.weakPassword',
    missing_name: 'err.missingName',
    email_taken: 'err.emailTaken',
    bad_credentials: 'err.badCredentials',
    too_many: 'err.tooMany',
    network: 'common.serverError',
  };
  const key = e.code ? byCode[e.code] : undefined;
  return key ? t(key) : e.message || t('err.generic');
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const isStrongPassword = (v: string) => v.length >= 8 && /\d/.test(v);

type FieldProps = TextInputProps & {
  label: string;
  /** Grey text after the label, e.g. "(facultatif)". */
  labelHint?: string;
  /** Shown under the field. */
  hint?: string;
  invalid?: boolean;
  /** Password field with a show/hide button. */
  password?: boolean;
  /** Extra element on the label row (e.g. "Mot de passe oublié ?"). */
  labelAction?: ReactNode;
};

export function TextField({ label, labelHint, hint, invalid, password, labelAction, style, ...input }: FieldProps) {
  const tr = useT();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {labelHint ? <Text style={styles.labelHint}> {labelHint}</Text> : null}
        </Text>
        {labelAction}
      </View>
      <View>
        <TextInput
          placeholderTextColor="#6B766F"
          accessibilityLabel={label}
          secureTextEntry={password && !visible}
          autoCorrect={false}
          style={[styles.input, password && { paddingEnd: 52 }, invalid && { borderColor: colors.danger }, style]}
          {...input}
        />
        {password ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={visible ? tr('auth.hidePassword') : tr('auth.showPassword')}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={20} color="#8F1F1F" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function SubmitButton({ label, onPress, loading, variant = 'solid', icon }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'solid' | 'outline' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const fg = variant === 'solid' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'solid' ? { backgroundColor: colors.primary } : { borderWidth: 1, borderColor: fg, backgroundColor: colors.surface },
        (pressed || loading) && { opacity: 0.8 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {checked ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export const formStyles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, paddingTop: 16, gap: 24, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, lineHeight: 32 },
  subtitle: { fontSize: 15, lineHeight: 22, color: colors.muted },
  form: { gap: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 'auto' },
  footerText: { fontSize: 15, color: colors.muted },
});

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  labelHint: { fontWeight: '400', color: colors.muted },
  input: {
    minHeight: 52, paddingHorizontal: 14, borderRadius: radius.md + 2, borderWidth: 1, borderColor: '#D5DAD4',
    backgroundColor: colors.surface, color: colors.text, fontSize: 16, textAlign: 'auto',
  },
  eye: { position: 'absolute', top: 4, bottom: 4, end: 4, width: 44, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13, color: colors.muted },
  error: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: radius.md + 2, backgroundColor: '#FBEAEA' },
  errorText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#8F1F1F' },
  button: { minHeight: 52, borderRadius: radius.md + 2, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 44, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
});
