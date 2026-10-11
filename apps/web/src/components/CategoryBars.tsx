import { categoryLabel, formatMoney, type CategorySlice } from '@budgetwise/core';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '@/theme';
import { CategoryIcon } from './ui';

/**
 * Spending by category as labelled horizontal bars in a single hue: magnitude
 * comparison without a rainbow, and every value is readable text.
 */
export function CategoryBars({ slices, limit = 8 }: { slices: CategorySlice[]; limit?: number }) {
  const shown = slices.slice(0, limit);
  const rest = slices.slice(limit);
  const rows = rest.length
    ? [
        ...shown,
        {
          category: 'other' as const,
          cents: rest.reduce((s, r) => s + r.cents, 0),
          share: rest.reduce((s, r) => s + r.share, 0),
          folded: true,
        },
      ]
    : shown;
  const max = Math.max(...rows.map((r) => r.cents), 1);

  return (
    <View style={styles.list} accessibilityRole="list">
      {rows.map((r) => {
        const label = 'folded' in r ? `${rest.length} more categories` : categoryLabel(r.category);
        return (
          <View
            key={'folded' in r ? 'folded' : r.category}
            style={styles.row}
            accessible
            accessibilityLabel={`${label}: ${formatMoney(r.cents)}, ${Math.round(r.share * 100)} percent`}
          >
            <CategoryIcon category={r.category} size={28} />
            <View style={styles.main}>
              <View style={styles.labels}>
                <Text style={styles.name} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.value}>
                  {formatMoney(r.cents)}{' '}
                  <Text style={styles.share}>{Math.round(r.share * 100)}%</Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${(r.cents / max) * 100}%` }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  main: { flex: 1, gap: 6 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  name: { flex: 1, fontSize: font.sm, color: colors.text, fontWeight: '600' },
  value: { fontSize: font.sm, color: colors.text, fontVariant: ['tabular-nums'] },
  share: { color: colors.textMuted },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
});
