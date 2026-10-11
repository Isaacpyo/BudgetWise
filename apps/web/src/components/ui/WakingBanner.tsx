import { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { apiStatus } from '@/lib/api';
import { colors, font, space } from '@/theme';

/**
 * Free Render services sleep when idle and take ~30–60s to wake. When any API
 * call is slow, explain what's happening instead of looking broken.
 */
export function WakingBanner() {
  const { waking } = useSyncExternalStore(
    apiStatus.subscribe,
    apiStatus.getSnapshot,
    apiStatus.getSnapshot,
  );
  if (!waking) return null;
  return (
    <View
      style={styles.banner}
      accessibilityLiveRegion="polite"
      role="status"
      testID="waking-banner"
    >
      <ActivityIndicator size="small" color={colors.text} />
      <Text style={styles.text}>
        <Text style={styles.bold}>Waking the server…</Text> The free hosting tier naps when idle;
        this can take up to a minute.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#fff4d6',
    borderBottomWidth: 1,
    borderBottomColor: '#f0d58a',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  text: { flex: 1, fontSize: font.sm, color: colors.text },
  bold: { fontWeight: '700' },
});
