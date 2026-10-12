import {
  categoryLabel,
  countRuleMatches,
  formatDay,
  formatTransactionAmount,
  ruleDraftFromTransaction,
  type CategoryId,
} from '@budgetwise/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { CategoryPicker } from '@/components/CategoryPicker';
import { SOURCE_LABEL } from '@/components/TransactionRow';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  InlineError,
  LoadingState,
  Screen,
} from '@/components/ui';
import { useData } from '@/context/DataContext';
import { api, errorMessage } from '@/lib/api';
import { colors, font, space } from '@/theme';

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, items, rules, loading } = useData();
  const tx = transactions.find((t) => t.id === id);

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [busy, setBusy] = useState<'save' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (loading) return <LoadingState />;
  if (!tx) {
    return (
      <Screen>
        <EmptyState
          icon="search-outline"
          title="Transaction not found"
          body="It may have been removed when a bank was unlinked or re-synced."
          action={
            <Button label="Back to transactions" onPress={() => router.replace('/transactions')} />
          }
        />
      </Screen>
    );
  }

  const selected = category ?? tx.category;
  const merchant = tx.merchantName ?? tx.name;
  const draft = ruleDraftFromTransaction(tx, selected);
  const matches = countRuleMatches(draft, transactions);
  const item = items.find((i) => i.id === tx.itemId);
  const account = item?.accounts.find((a) => a.id === tx.accountId);
  const rule = tx.ruleId ? rules.find((r) => r.id === tx.ruleId) : undefined;
  const changed = selected !== tx.category || applyToAll;

  async function save() {
    setBusy('save');
    setError(null);
    setResult(null);
    try {
      const res = await api.setTransactionCategory(tx!.id, {
        category: selected,
        createRule: applyToAll,
      });
      setResult(
        res.rule
          ? `Saved. New rule "${res.rule.pattern}" → ${categoryLabel(res.rule.category)} updated ${res.recategorized} transaction${res.recategorized === 1 ? '' : 's'}.`
          : `Saved as ${categoryLabel(selected)}.`,
      );
      setCategory(null);
      setApplyToAll(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy('reset');
    setError(null);
    setResult(null);
    try {
      const res = await api.setTransactionCategory(tx!.id, { category: null });
      setResult(`Back to automatic: ${categoryLabel(res.transaction.category)}.`);
      setCategory(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen testID="transaction-detail">
      <Card>
        <View style={styles.head}>
          <CategoryIcon category={tx.category} size={44} />
          <View style={styles.headText}>
            <Text style={styles.merchant} accessibilityRole="header">
              {merchant}
            </Text>
            <Text style={styles.meta}>
              {formatDay(tx.date)} ·{' '}
              {account
                ? `${account.name}${account.mask ? ` ••${account.mask}` : ''}`
                : (item?.institutionName ?? 'Bank')}
            </Text>
          </View>
          <Text style={[styles.amount, tx.amountCents < 0 && styles.inflow]}>
            {formatTransactionAmount(tx.amountCents, tx.currency)}
          </Text>
        </View>
        <View style={styles.badges}>
          {tx.pending ? <Badge label="Pending" tone="warning" /> : null}
          <Badge
            label={`${categoryLabel(tx.category)} · ${SOURCE_LABEL[tx.categorySource]}`}
            tone="info"
          />
        </View>
        <Text style={styles.detail}>Bank description: {tx.name}</Text>
        {tx.plaidCategory ? (
          <Text style={styles.detail}>
            Plaid category: {tx.plaidCategory.detailed.replaceAll('_', ' ').toLowerCase()}
          </Text>
        ) : null}
        {rule ? (
          <Text style={styles.detail}>
            Matched your rule: {rule.field === 'merchant' ? 'merchant' : 'description'}{' '}
            {rule.operator === 'startsWith' ? 'starts with' : rule.operator} “{rule.pattern}”
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.section} accessibilityRole="header">
          Category
        </Text>
        <CategoryPicker value={selected} onChange={setCategory} />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel} nativeID="apply-all-label">
              Always use this category for “{draft.pattern}”
            </Text>
            <Text style={styles.switchHint}>
              Creates a rule. It applies to {matches} existing transaction{matches === 1 ? '' : 's'}{' '}
              and future ones.
            </Text>
          </View>
          <Switch
            value={applyToAll}
            onValueChange={setApplyToAll}
            accessibilityLabel={`Always use this category for ${draft.pattern}`}
            trackColor={{ true: colors.primary, false: colors.context }}
            testID="apply-to-all"
          />
        </View>
        <InlineError message={error} />
        {result ? (
          <Text style={styles.success} accessibilityLiveRegion="polite" testID="save-result">
            {result}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            label="Save"
            onPress={save}
            loading={busy === 'save'}
            disabled={!changed || busy === 'reset'}
            testID="save-category"
          />
          {tx.categorySource === 'manual' ? (
            <Button
              label="Reset to automatic"
              variant="secondary"
              icon="refresh"
              onPress={reset}
              loading={busy === 'reset'}
              disabled={busy === 'save'}
            />
          ) : null}
          <Button
            label="Close"
            variant="ghost"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/transactions'))}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, gap: 2 },
  merchant: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  meta: { fontSize: font.sm, color: colors.textSecondary },
  amount: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  inflow: { color: colors.successText },
  badges: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  detail: { fontSize: font.sm, color: colors.textSecondary },
  section: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  switchHint: { fontSize: font.xs, color: colors.textSecondary },
  success: { fontSize: font.sm, color: colors.successText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
