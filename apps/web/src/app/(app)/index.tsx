import {
  categoryLabel,
  computeBudgetProgress,
  formatMoney,
  formatMonth,
  monthSummary,
  summarizeBudgets,
} from '@budgetwise/core';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BudgetRow } from '@/components/BudgetRow';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
  Meter,
  MonthPicker,
  Screen,
  SectionHeader,
  StatTile,
} from '@/components/ui';
import { useData } from '@/context/DataContext';
import { useSync } from '@/hooks/useSync';
import { formatChange, timeAgo } from '@/lib/format';
import { colors, font, space } from '@/theme';

export default function OverviewScreen() {
  const data = useData();
  const { transactions, budgets, items, month, months, setMonth, today, profile } = data;
  const { sync, syncing, message, error: syncError } = useSync();

  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month]);
  const progress = useMemo(
    () => computeBudgetProgress(transactions, budgets, month, today),
    [transactions, budgets, month, today],
  );
  const totals = summarizeBudgets(progress);
  const recent = useMemo(
    () => transactions.filter((t) => t.month === month).slice(0, 5),
    [transactions, month],
  );

  if (data.error) return <ErrorState message={data.error} onRetry={data.retry} />;
  if (data.loading) return <LoadingState label="Loading your finances…" />;

  if (items.length === 0 && transactions.length === 0) {
    return (
      <Screen title="Welcome to BudgetWise">
        <Card>
          <EmptyState
            icon="link-outline"
            title="Link your first bank"
            body="Connect a sandbox bank through Plaid Link. We'll import about five months of transactions and categorise them automatically."
            action={
              <Button
                label="Link a bank"
                icon="add"
                onPress={() => router.push('/link-bank')}
                testID="link-first-bank"
              />
            }
          />
        </Card>
      </Screen>
    );
  }

  const change = summary.spendingChange;
  const lastSynced =
    items
      .map((i) => i.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return (
    <Screen
      title="Overview"
      subtitle={
        profile?.isDemo ? 'Demo account · sandbox data' : `Last synced ${timeAgo(lastSynced)}`
      }
      right={<MonthPicker month={month} months={months} onChange={setMonth} />}
      testID="overview"
    >
      <View style={styles.tiles}>
        <StatTile
          label={`Spent in ${formatMonth(month, { short: true })}`}
          value={formatMoney(summary.spendingCents)}
          detail={change == null ? undefined : `${formatChange(change)} vs last month`}
          detailTone={change == null ? 'neutral' : change > 0 ? 'bad' : 'good'}
          testID="stat-spent"
        />
        <StatTile label="Income" value={formatMoney(summary.incomeCents)} />
        <StatTile
          label="Net"
          value={formatMoney(summary.netCents, 'USD', { signed: true })}
          detail={summary.topCategory ? `Top: ${categoryLabel(summary.topCategory)}` : undefined}
        />
      </View>

      <Card>
        <SectionHeader title="Budgets" linkLabel="See all" href="/budgets" />
        {progress.length === 0 ? (
          <View style={styles.inlineEmpty}>
            <Text style={styles.muted}>
              No budgets yet. Set a monthly limit for a category to track it here.
            </Text>
            <Button
              label="Set a budget"
              variant="secondary"
              compact
              icon="add"
              onPress={() => router.push('/budgets')}
            />
          </View>
        ) : (
          <>
            <View style={styles.total}>
              <Text style={styles.totalText}>
                <Text style={styles.bold}>{formatMoney(totals.spentCents)}</Text> of{' '}
                {formatMoney(totals.limitCents)} budgeted
                {totals.overCount ? ` · ${totals.overCount} over` : ''}
              </Text>
              <Meter
                ratio={totals.ratio}
                color={totals.ratio > 1 ? colors.status.critical : colors.accent}
                label="Total budget used"
              />
            </View>
            {progress.slice(0, 3).map((p) => (
              <BudgetRow key={p.category} progress={p} />
            ))}
          </>
        )}
      </Card>

      <Card>
        <SectionHeader title="Recent transactions" linkLabel="See all" href="/transactions" />
        {recent.length === 0 ? (
          <Text style={styles.muted}>No transactions in {formatMonth(month)}.</Text>
        ) : (
          recent.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
        )}
      </Card>

      <View style={styles.syncRow}>
        <Button
          label="Sync now"
          icon="sync"
          variant="secondary"
          onPress={sync}
          loading={syncing}
          testID="sync-now"
        />
        <Button
          label="Link another bank"
          icon="add"
          variant="ghost"
          onPress={() => router.push('/link-bank')}
        />
      </View>
      {message ? (
        <Text style={styles.success} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
      <InlineError message={syncError} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  inlineEmpty: { gap: space.md, alignItems: 'flex-start' },
  muted: { fontSize: font.sm, color: colors.textSecondary },
  total: {
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalText: { fontSize: font.sm, color: colors.textSecondary },
  bold: { fontWeight: '700', color: colors.text },
  syncRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  success: { fontSize: font.sm, color: colors.successText },
});
