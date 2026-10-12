import { formatMoney, formatMonth, type MonthTotals } from '@budgetwise/core';
import { useFont } from '@shopify/react-native-skia';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bar, CartesianChart, type ChartBounds } from 'victory-native';
import { colors } from '@/theme';
import { axis, CHART_FONT } from './chartTheme';

/**
 * Six months of spending as columns. The selected month is the accent hue;
 * the rest are recessive context (emphasis form, single axis from zero).
 * Tapping a column selects that month.
 */
export function MonthlySpendChart({
  data,
  selected,
  onSelect,
}: {
  data: MonthTotals[];
  selected: string;
  onSelect: (month: string) => void;
}) {
  const font = useFont(CHART_FONT, 11);
  const bounds = useRef<ChartBounds | null>(null);
  const chartData = data.map((d) => ({
    label: formatMonth(d.month, { short: true }),
    spend: d.spendingCents / 100,
  }));
  const summary = data
    .map((d) => `${formatMonth(d.month)} ${formatMoney(d.spendingCents)}`)
    .join(', ');

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Monthly spending: ${summary}`}
      testID="monthly-chart"
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        accessible={false}
        focusable={false}
        onPress={(e) => {
          const b = bounds.current;
          if (!b || data.length === 0) return;
          const x = e.nativeEvent.locationX;
          const i = Math.floor(((x - b.left) / Math.max(1, b.right - b.left)) * data.length);
          const target = data[Math.max(0, Math.min(data.length - 1, i))];
          if (target) onSelect(target.month);
        }}
      >
        <CartesianChart
          data={chartData}
          xKey="label"
          yKeys={['spend']}
          domain={{ y: [0] }}
          domainPadding={{ left: 32, right: 32, top: 24 }}
          onChartBoundsChange={(b) => {
            bounds.current = b;
          }}
          xAxis={{ font, ...axis, tickCount: chartData.length, lineWidth: 0 }}
          yAxis={[
            {
              font,
              ...axis,
              tickCount: 4,
              formatYLabel: (v) => formatMoney(Number(v) * 100, 'USD', { compact: true }),
            },
          ]}
          frame={{ lineWidth: 0 }}
        >
          {({ points, chartBounds }) =>
            points.spend.map((p, i) => {
              const isSelected = data[i]?.month === selected;
              return (
                <Bar
                  key={String(p.xValue)}
                  points={[p]}
                  barCount={chartData.length}
                  chartBounds={chartBounds}
                  innerPadding={0.35}
                  roundedCorners={{ topLeft: 4, topRight: 4 }}
                  color={isSelected ? colors.accent : colors.context}
                  labels={
                    isSelected && font
                      ? {
                          position: 'top',
                          font,
                          color: colors.text,
                          formatLabel: (v) =>
                            formatMoney(Number(v) * 100, 'USD', { compact: true }),
                        }
                      : undefined
                  }
                />
              );
            })
          }
        </CartesianChart>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 220, width: '100%' },
});
