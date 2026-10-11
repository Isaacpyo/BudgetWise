import {
  addMonths,
  CATEGORIES,
  computeBudgetProgress,
  EXPENSE_CATEGORY_IDS,
  formatMoney,
  formatMonth,
  parseMoneyInput,
  suggestBudget,
  summarizeBudgets,
  type CategoryId,
} from '@budgetwise/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetRow } from '@/components/BudgetRow';
import {
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  Meter,
  MonthPicker,
  Screen,
  SectionHeader,
  TextField,
} from '@/components/ui';
import type { InteractionState } from '@/components/ui/interaction';
import { useData } from '@/context/DataContext';
import { api, errorMessage } from '@/lib/api';
import { colors, focusRing, font, space } from '@/theme';

function BudgetEditor({
  category,
  initialCents,
  existing,
  onDone,
}: {
  category: CategoryId;
  initialCents: number | null;
  existing: boolean;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initialCents ? String(initialCents / 100) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const label = CATEGORIES[category].label;

  async function save() {
    const cents = parseMoneyInput(value);
    if (cents == null || cents < 100) {
      setError('Enter an amount of at least $1, like 250 or 99.50.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      await api.setBudget(category, cents);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('remove');
    setError(null);
    try {
      await api.deleteBudget(category);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={styles.editor} testID="budget-editor">
      <View style={styles.editorHead}>
        <CategoryIcon category={category} />
        <Text style={styles.editorTitle} accessibilityRole="header">
          {existing ? `Edit ${label} budget` : `New ${label} budget`}
        </Text>
      </View>
      <TextField
        label="Monthly limit"
        prefix="$"
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={error}
        hint={initialCents && !existing ? 'Suggested from your average monthly spend.' : undefined}
        onSubmitEditing={save}
        autoFocus
        testID="budget-amount"
      />
      <View style={styles.editorActions}>
        <Button
          label="Save budget"
          onPress={save}
          loading={busy === 'save'}
          disabled={busy === 'remove'}
          testID="save-budget"
        />
        <Button label="Cancel" variant="secondary" onPress={onDone} disabled={!!busy} />
        {existing ? (
          <Button
            label="Remove"
            variant="danger"
            icon="trash-outline"
            onPress={remove}
            loading={busy === 'remove'}
            disabled={busy === 'save'}
          />
        ) : null}
      </View>
    </Card>
  );
}

export default function BudgetsScreen() {
  const {
    transactions,
    budgets,
    month,
    months,
    setMonth,
    today,
    currentMonth,
    loading,
    error,
    retry,
  } = useData();
  const [editing, setEditing] = useState<CategoryId | null>(null);

  const progress = useMemo(
    () => computeBudgetProgress(transactions, budgets, month, today),
    [transactions, budgets, month, today],
  );
  const totals = summarizeBudgets(progress);
  const history = useMemo(() => [1, 2, 3].map((i) => addMonths(currentMonth, -i)), [currentMonth]);
  const unbudgeted = useMemo(() => {
    const has = new Set(budgets.map((b) => b.category));
    return EXPENSE_CATEGORY_IDS.filter((c) => !has.has(c)).map((c) => ({
      category: c,
      suggestion: suggestBudget(transactions, c, history),
    }));
  }, [budgets, transactions, history]);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) return <LoadingState label="Loading budgets…" />;

  const editingBudget = editing ? budgets.find((b) => b.category === editing) : undefined;
  const editingSuggestion = editing
    ? (unbudgeted.find((u) => u.category === editing)?.suggestion ?? null)
    : null;

  return (
    <Screen
      title="Budgets"
      subtitle={
        month === currentMonth
          ? 'The tick marks where an even pace would put you today.'
          : `Spending in ${formatMonth(month)}`
      }
      right={<MonthPicker month={month} months={months} onChange={setMonth} />}
      testID="budgets"
    >
      {editing ? (
        <BudgetEditor
          key={editing}
          category={editing}
          existing={!!editingBudget}
          initialCents={editingBudget?.limitCents ?? editingSuggestion}
          onDone={() => setEditing(null)}
        />
      ) : null}

      {progress.length === 0 ? (
        <Card>
          <EmptyState
            icon="pie-chart-outline"
            title="No budgets yet"
            body="Pick a category below to set a monthly limit. Suggestions come from your last three months of spending."
          />
        </Card>
      ) : (
        <Card>
          <View style={styles.total}>
            <Text style={styles.totalText}>
              <Text style={styles.bold}>{formatMoney(totals.spentCents)}</Text> spent of{' '}
              {formatMoney(totals.limitCents)} across {progress.length} budget
              {progress.length === 1 ? '' : 's'}
            </Text>
            <Meter
              ratio={totals.ratio}
              color={totals.ratio > 1 ? colors.status.critical : colors.accent}
              label="Total budget used"
            />
          </View>
          {progress.map((p) => (
            <BudgetRow key={p.category} progress={p} onPress={() => setEditing(p.category)} />
          ))}
        </Card>
      )}

      {unbudgeted.length ? (
        <Card>
          <SectionHeader title="Add a budget" />
          <View style={styles.addList}>
            {unbudgeted.map(({ category, suggestion }) => (
              <Pressable
                key={category}
                onPress={() => setEditing(category)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${CATEGORIES[category].label} budget${suggestion ? `, suggested ${formatMoney(suggestion)}` : ''}`}
                testID={`add-budget-${category}`}
                style={(state) => {
                  const s = state as InteractionState;
                  return [
                    styles.addRow,
                    (s.hovered || s.pressed) && styles.addRowHover,
                    s.focused && focusRing,
                  ];
                }}
              >
                <CategoryIcon category={category} size={32} />
                <Text style={styles.addName}>{CATEGORIES[category].label}</Text>
                <Text style={styles.addHint}>
                  {suggestion ? `~${formatMoney(suggestion)}/mo` : 'No recent spend'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editor: { borderColor: colors.primary, borderWidth: 2 },
  editorHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  editorTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  editorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  total: {
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalText: { fontSize: font.sm, color: colors.textSecondary },
  bold: { fontWeight: '700', color: colors.text },
  addList: { gap: space.xs },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: 10,
    minHeight: 48,
  },
  addRowHover: { backgroundColor: colors.surfaceAlt },
  addName: { flex: 1, fontSize: font.md, color: colors.text },
  addHint: { fontSize: font.sm, color: colors.textSecondary },
});
