import {
  categoryLabel,
  countRuleMatches,
  parseMoneyInput,
  ruleInputSchema,
  sortRules,
  type CategoryId,
  type Rule,
  type RuleField,
  type RuleOperator,
} from '@budgetwise/core';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CategoryPicker } from '@/components/CategoryPicker';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  ErrorState,
  InlineError,
  LoadingState,
  Screen,
  SectionHeader,
  TextField,
} from '@/components/ui';
import { useData } from '@/context/DataContext';
import { api, errorMessage } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { colors, font, space } from '@/theme';

const OPERATOR_LABEL: Record<RuleOperator, string> = {
  contains: 'contains',
  equals: 'is exactly',
  startsWith: 'starts with',
};

function describe(
  rule: Pick<Rule, 'field' | 'operator' | 'pattern' | 'minAmountCents' | 'maxAmountCents'>,
) {
  const amount =
    rule.minAmountCents != null || rule.maxAmountCents != null
      ? ` and amount ${rule.minAmountCents != null ? `≥ $${rule.minAmountCents / 100}` : ''}${rule.minAmountCents != null && rule.maxAmountCents != null ? ' and ' : ''}${rule.maxAmountCents != null ? `≤ $${rule.maxAmountCents / 100}` : ''}`
      : '';
  return `${rule.field === 'merchant' ? 'Merchant' : 'Description'} ${OPERATOR_LABEL[rule.operator]} “${rule.pattern}”${amount}`;
}

function RuleRow({ rule, matches }: { rule: Rule; matches: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (
      !(await confirmAction(
        'Delete rule?',
        `${describe(rule)} → ${categoryLabel(rule.category)}`,
        'Delete',
      ))
    )
      return;
    setBusy(true);
    try {
      await api.deleteRule(rule.id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <View style={styles.ruleRow} testID="rule-row">
      <CategoryIcon category={rule.category} size={32} />
      <View style={styles.ruleText}>
        <Text style={styles.ruleTitle}>{describe(rule)}</Text>
        <Text style={styles.ruleMeta}>
          → {categoryLabel(rule.category)} · {matches} transaction{matches === 1 ? '' : 's'}
        </Text>
        <InlineError message={error} />
      </View>
      <Button
        label="Delete"
        variant="danger"
        compact
        icon="trash-outline"
        onPress={remove}
        loading={busy}
        accessibilityLabel={`Delete rule ${describe(rule)}`}
      />
    </View>
  );
}

export default function RulesScreen() {
  const { rules, transactions, loading, error, retry } = useData();
  const [field, setField] = useState<RuleField>('merchant');
  const [operator, setOperator] = useState<RuleOperator>('contains');
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => sortRules(rules), [rules]);
  const draft = {
    field,
    operator,
    pattern,
    minAmountCents: min ? parseMoneyInput(min) : null,
    maxAmountCents: max ? parseMoneyInput(max) : null,
  };
  const preview = pattern.trim().length >= 2 ? countRuleMatches(draft, transactions) : null;

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) return <LoadingState />;

  async function create() {
    setFormError(null);
    setResult(null);
    if ((min && draft.minAmountCents == null) || (max && draft.maxAmountCents == null)) {
      setFormError('Amounts must be numbers like 25 or 99.50.');
      return;
    }
    const parsed = ruleInputSchema.safeParse({ ...draft, category });
    if (!parsed.success) {
      setFormError(
        category ? (parsed.error.issues[0]?.message ?? 'Check the rule.') : 'Pick a category.',
      );
      return;
    }
    setBusy(true);
    try {
      const res = await api.createRule(parsed.data);
      setResult(
        `Rule created. ${res.recategorized} transaction${res.recategorized === 1 ? '' : 's'} re-categorised.`,
      );
      setPattern('');
      setMin('');
      setMax('');
      setCategory(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="rules-screen">
      <Text style={styles.intro}>
        Rules run before Plaid&apos;s categories. The first matching rule wins, and the newest rules
        run first. Changing rules re-categorises past transactions too (manual edits are kept).
      </Text>

      <Card>
        <SectionHeader title="New rule" />
        <Text style={styles.label}>Match on</Text>
        <View style={styles.row}>
          <Chip
            label="Merchant"
            selected={field === 'merchant'}
            onPress={() => setField('merchant')}
          />
          <Chip
            label="Description"
            selected={field === 'description'}
            onPress={() => setField('description')}
          />
        </View>
        <View style={styles.row}>
          {(Object.keys(OPERATOR_LABEL) as RuleOperator[]).map((op) => (
            <Chip
              key={op}
              label={OPERATOR_LABEL[op]}
              selected={operator === op}
              onPress={() => setOperator(op)}
            />
          ))}
        </View>
        <TextField
          label="Text to match"
          value={pattern}
          onChangeText={setPattern}
          placeholder="e.g. Blue Bottle"
          autoCapitalize="none"
          hint={
            preview != null
              ? `Matches ${preview} of your recent transactions.`
              : 'Case-insensitive.'
          }
          testID="rule-pattern"
        />
        <View style={styles.amounts}>
          <View style={styles.amount}>
            <TextField
              label="Min amount (optional)"
              prefix="$"
              value={min}
              onChangeText={setMin}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.amount}>
            <TextField
              label="Max amount (optional)"
              prefix="$"
              value={max}
              onChangeText={setMax}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        <Text style={styles.label}>Categorise as</Text>
        <CategoryPicker value={category} onChange={setCategory} />
        <InlineError message={formError} />
        {result ? <Text style={styles.success}>{result}</Text> : null}
        <Button
          label="Create rule"
          icon="add"
          onPress={create}
          loading={busy}
          testID="create-rule"
        />
      </Card>

      <Card>
        <SectionHeader title={`Your rules (${sorted.length})`} />
        {sorted.length === 0 ? (
          <Text style={styles.muted}>
            No rules yet. Tip: on any transaction, choose a category and switch on “Always use this
            category”.
          </Text>
        ) : (
          sorted.map((r) => (
            <RuleRow key={r.id} rule={r} matches={countRuleMatches(r, transactions)} />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  amounts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  amount: { flexGrow: 1, flexBasis: 160 },
  success: { fontSize: font.sm, color: colors.successText },
  muted: { fontSize: font.sm, color: colors.textSecondary },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ruleText: { flex: 1, gap: 2 },
  ruleTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  ruleMeta: { fontSize: font.xs, color: colors.textSecondary },
});
