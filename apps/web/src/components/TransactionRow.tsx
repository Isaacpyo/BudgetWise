import {
  categoryLabel,
  formatDay,
  formatTransactionAmount,
  type Transaction,
} from '@budgetwise/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, focusRing, font, space } from '@/theme';
import { Badge, CategoryIcon } from './ui';
import type { InteractionState } from './ui/interaction';

export const SOURCE_LABEL: Record<Transaction['categorySource'], string> = {
  manual: 'Edited',
  rule: 'Rule',
  plaid: 'Plaid category',
  keyword: 'Merchant match',
  default: 'Uncategorised',
};

export function TransactionRow({ tx, showDate = true }: { tx: Transaction; showDate?: boolean }) {
  const title = tx.merchantName ?? tx.name;
  const amount = formatTransactionAmount(tx.amountCents, tx.currency);
  const inflow = tx.amountCents < 0;
  const meta = [categoryLabel(tx.category), showDate ? formatDay(tx.date) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount}, ${meta}${tx.pending ? ', pending' : ''}`}
      accessibilityHint="Opens the transaction to change its category"
      testID="transaction-row"
      style={(state) => {
        const s = state as InteractionState;
        return [styles.row, (s.hovered || s.pressed) && styles.rowHover, s.focused && focusRing];
      }}
    >
      <CategoryIcon category={tx.category} />
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          {tx.pending ? <Badge label="Pending" tone="warning" /> : null}
          {tx.categorySource === 'manual' || tx.categorySource === 'rule' ? (
            <Badge label={SOURCE_LABEL[tx.categorySource]} tone="info" />
          ) : null}
        </View>
      </View>
      <Text style={[styles.amount, inflow && styles.inflow]}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderRadius: 10,
    minHeight: 56,
  },
  rowHover: { backgroundColor: colors.surfaceAlt },
  main: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: font.md, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  meta: { fontSize: font.xs, color: colors.textSecondary, flexShrink: 1 },
  amount: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  inflow: { color: colors.successText },
});
