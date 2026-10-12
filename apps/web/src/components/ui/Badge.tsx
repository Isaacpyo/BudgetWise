import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme';

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'info' | 'warning';
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'info' && { backgroundColor: colors.primarySoft },
        tone === 'warning' && { backgroundColor: '#fff4d6' },
      ]}
    >
      <Text style={[styles.text, tone === 'info' && { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.2 },
});
