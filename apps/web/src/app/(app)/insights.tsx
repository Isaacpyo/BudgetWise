import {
  addMonths,
  categoryBreakdown,
  dayOfMonth,
  formatMoney,
  formatMonth,
  monthlyTotals,
  monthSummary,
  spendingPace,
} from '@budgetwise/core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryBars } from '@/components/CategoryBars';
import { ChartsHost } from '@/components/charts/ChartsHost';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MonthPicker,
  Screen,
  SectionHeader,
  StatTile,
} from '@/components/ui';
import { useData } from '@/context/DataContext';
import { formatChange } from '@/lib/format';
import { colors, font, space } from '@/theme';

export default function InsightsScreen() {
  const { transactions, month, months, setMonth, today, currentMonth, loading, error, retry } =
    useData();

  const monthly = useMemo(() => monthlyTotals(transactions, months), [transactions, months]);
  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month]);
  const breakdown = useMemo(() => categoryBreakdown(transactions, month), [transactions, month]);
  const pace = useMemo(
    () => spendingPace(transactions, month, today),
    [transactions, month, today],
  );

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) return <LoadingState label="Crunching numbers…" />;

  if (transactions.length === 0) {
    return (
      <Screen title="Insights">
        <Card>
          <EmptyState
            icon="bar-chart-outline"
            title="No data yet"
            body="Link a bank to see where your money goes."
          />
        </Card>
      </Screen>
    );
  }

  const previous = addMonths(month, -1);
  const day = month === currentMonth ? dayOfMonth(today) : pace.length;
  const nowPoint = pace[Math.min(day, pace.length) - 1];
  const paceLabel = nowPoint
    ? `By day ${day} you'd spent ${formatMoney(Math.round((nowPoint.current ?? 0) * 100))} in ${formatMonth(month)}, versus ${formatMoney(Math.round((nowPoint.previous ?? 0) * 100))} by the same day of ${formatMonth(previous)}.`
    : '';
  const change = summary.spendingChange;

  return (
    <Screen
      title="Insights"
      right={<MonthPicker month={month} months={months} onChange={setMonth} />}
      testID="insights"
    >
      <View style={styles.tiles}>
        <StatTile
          label="Spent"
          value={formatMoney(summary.spendingCents)}
          detail={
            change == null
              ? undefined
              : `${formatChange(change)} vs ${formatMonth(previous, { short: true })}`
          }
          detailTone={change == null ? 'neutral' : change > 0 ? 'bad' : 'good'}
        />
        <StatTile label="Income" value={formatMoney(summary.incomeCents)} />
        <StatTile label="Transactions" value={String(summary.transactionCount)} />
      </View>

      <Card>
        <ChartsHost
          monthly={monthly}
          selected={month}
          onSelect={setMonth}
          pace={pace}
          paceLabel={paceLabel}
          currentLabel={formatMonth(month)}
          previousLabel={formatMonth(previous)}
        />
      </Card>

      <Card>
        <SectionHeader title={`Where it went in ${formatMonth(month, { short: true })}`} />
        {breakdown.length ? (
          <CategoryBars slices={breakdown} />
        ) : (
          <Text style={styles.muted}>No spending recorded this month.</Text>
        )}
      </Card>

      <Card>
        <SectionHeader title="Monthly totals" />
        <View accessibilityRole="list">
          {monthly.map((m) => (
            <View key={m.month} style={styles.tableRow}>
              <Text style={[styles.cell, m.month === month && styles.bold]}>
                {formatMonth(m.month)}
              </Text>
              <Text style={[styles.cellNum, m.month === month && styles.bold]}>
                {formatMoney(m.spendingCents)}
              </Text>
              <Text style={[styles.cellNum, styles.muted]}>{formatMoney(m.incomeCents)} in</Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  muted: { fontSize: font.sm, color: colors.textSecondary },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space.sm,
  },
  cell: { flex: 1, fontSize: font.sm, color: colors.text },
  cellNum: {
    flex: 1,
    fontSize: font.sm,
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  bold: { fontWeight: '700' },
});
