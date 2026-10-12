import type { MonthTotals, PacePoint } from '@budgetwise/core';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/theme';
import { MonthlySpendChart } from './MonthlySpendChart';
import { SpendingPaceChart } from './SpendingPaceChart';

export interface InsightsChartsProps {
  monthly: MonthTotals[];
  selected: string;
  onSelect: (month: string) => void;
  pace: PacePoint[];
  paceLabel: string;
  currentLabel: string;
  previousLabel: string;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

/** Everything that needs Skia. On web this module is lazy-loaded with CanvasKit. */
export default function InsightsCharts(props: InsightsChartsProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.block}>
        <Text style={styles.title} accessibilityRole="header">
          Monthly spending
        </Text>
        <Text style={styles.caption}>Tap a column to explore that month.</Text>
        <MonthlySpendChart
          data={props.monthly}
          selected={props.selected}
          onSelect={props.onSelect}
        />
      </View>
      <View style={styles.block}>
        <Text style={styles.title} accessibilityRole="header">
          Spending pace
        </Text>
        <View style={styles.legend}>
          <LegendItem color={colors.accent} label={props.currentLabel} />
          <LegendItem color={colors.context} label={props.previousLabel} />
        </View>
        <SpendingPaceChart data={props.pace} label={props.paceLabel} />
        <Text style={styles.caption}>{props.paceLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  block: { gap: space.sm },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  caption: { fontSize: font.sm, color: colors.textSecondary },
  legend: { flexDirection: 'row', gap: space.lg, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  legendText: { fontSize: font.xs, color: colors.textSecondary },
});
