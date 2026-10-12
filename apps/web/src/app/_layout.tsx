import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WakingBanner } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { api } from '@/lib/api';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { user, initializing } = useAuth();

  // Free Render instances sleep when idle: start waking the API immediately.
  useEffect(() => {
    api.health().catch(() => undefined);
  }, []);

  if (initializing) {
    return (
      <View style={[styles.fill, styles.center]} accessibilityLabel="Loading BudgetWise">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <WakingBanner />
      <DataProvider uid={user?.uid ?? null}>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.page } }}
        >
          <Stack.Protected guard={!user}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(app)" />
            <Stack.Screen
              name="transaction/[id]"
              options={{ presentation: 'modal', headerShown: true, title: 'Transaction' }}
            />
            <Stack.Screen
              name="link-bank"
              options={{ presentation: 'modal', headerShown: true, title: 'Link a bank' }}
            />
            <Stack.Screen
              name="rules"
              options={{ headerShown: true, title: 'Categorisation rules' }}
            />
          </Stack.Protected>
        </Stack>
      </DataProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  center: { alignItems: 'center', justifyContent: 'center' },
});
