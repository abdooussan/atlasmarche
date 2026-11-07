import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName, focusedName: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? focusedName : name} color={typeof color === 'string' ? color : undefined} size={size} />
  );
}

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), headerShown: false, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="consultations" options={{ title: t('tabs.consultations'), headerShown: false, tabBarIcon: icon('search-outline', 'search') }} />
      <Tabs.Screen name="attributions" options={{ title: t('tabs.attributions'), tabBarIcon: icon('ribbon-outline', 'ribbon') }} />
      <Tabs.Screen name="favoris" options={{ title: t('tabs.favorites'), tabBarIcon: icon('bookmark-outline', 'bookmark') }} />
    </Tabs>
  );
}
