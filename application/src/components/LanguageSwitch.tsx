import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { applyDirection, t, useLang, type Lang } from '@/lib/i18n';
import { colors } from '@/lib/theme';

/** Button that switches between Français and العربية. Shows the language you switch TO. */
export function LanguageSwitch({ variant = 'default' }: { variant?: 'default' | 'onPrimary' }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const next: Lang = lang === 'fr' ? 'ar' : 'fr';
  const onPrimary = variant === 'onPrimary';

  const onPress = () => {
    setLang(next);
    // Texts change at once; on a phone the right-to-left layout needs a restart.
    if (applyDirection(next) && Platform.OS !== 'web') {
      Alert.alert(t('lang.restartTitle'), t('lang.restartMsg'));
    }
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('lang.title')}
      style={({ pressed }) => [styles.btn, onPrimary ? styles.onPrimary : styles.plain, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="language-outline" size={16} color={onPrimary ? '#FFFFFF' : colors.primary} />
      <Text style={[styles.text, { color: onPrimary ? '#FFFFFF' : colors.primary }]}>{next === 'ar' ? 'العربية' : 'Français'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, marginTop: 12 },
  onPrimary: { backgroundColor: 'rgba(255,255,255,0.18)' },
  plain: { borderWidth: 1, borderColor: colors.primary, alignSelf: 'flex-start', marginTop: 0 },
  text: { fontSize: 14, fontWeight: '600' },
});
