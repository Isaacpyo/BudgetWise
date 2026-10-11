import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color as string} />
  );

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // 10px keeps "Transactions" untruncated on 375px phones.
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.page },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Transactions', tabBarIcon: icon('list-outline') }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ title: 'Budgets', tabBarIcon: icon('pie-chart-outline') }}
      />
      <Tabs.Screen
        name="insights"
        options={{ title: 'Insights', tabBarIcon: icon('bar-chart-outline') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Accounts', tabBarIcon: icon('settings-outline') }}
      />
    </Tabs>
  );
}
