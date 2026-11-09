import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/** Round button in the home header: shows who is signed in and offers to sign out. */
export function AccountButton() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const onPress = () => {
    const title = t('auth.logoutConfirm');
    const message = t('auth.logoutMsg', { email: user?.email ?? '' });
    if (Platform.OS === 'web') {
      // Alert with buttons does nothing on the web.
      if (window.confirm(`${title}\n${message}`)) void logout();
      return;
    }
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${t('auth.account')}, ${t('auth.logout')}`}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="person-circle-outline" size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 36, height: 36, borderRadius: 18, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
});
