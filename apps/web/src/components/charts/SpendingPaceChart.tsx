import { formatMoney, type PacePoint } from '@budgetwise/core';
import { useFont } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { colors } from '@/theme';
import { axis, CHART_FONT } from './chartTheme';

/** Cumulative spend by day: this month (accent) vs last month (grey context). */
export function SpendingPaceChart({ data, label }: { data: PacePoint[]; label: string }) {
  const font = useFont(CHART_FONT, 11);
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="pace-chart"
    >
      <CartesianChart
        data={data}
        xKey="day"
        yKeys={['current', 'previous']}
        domain={{ y: [0] }}
        domainPadding={{ top: 12 }}
        xAxis={{ font, ...axis, tickValues: [1, 8, 15, 22, 29], lineWidth: 0 }}
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
        {({ points }) => (
          <>
            <Line
              points={points.previous}
              color={colors.context}
              strokeWidth={2}
              curveType="linear"
            />
            <Line
              points={points.current}
              color={colors.accent}
              strokeWidth={2.5}
              curveType="linear"
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 200, width: '100%' },
});
