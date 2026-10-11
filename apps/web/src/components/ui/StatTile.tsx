import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';

/** A KPI tile: the number is the chart. */
export function StatTile({
  label,
  value,
  detail,
  detailTone = 'neutral',
  testID,
}: {
  label: string;
  value: string;
  detail?: string;
  detailTone?: 'neutral' | 'good' | 'bad';
  testID?: string;
}) {
  return (
    <View
      style={styles.tile}
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {detail ? (
        <Text
          style={[
            styles.detail,
            detailTone === 'good' && { color: colors.successText },
            detailTone === 'bad' && { color: colors.dangerText },
          ]}
        >
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.xs,
  },
  label: { fontSize: font.sm, color: colors.textSecondary },
  value: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  detail: { fontSize: font.xs, color: colors.textMuted },
});
