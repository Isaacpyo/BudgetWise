import Ionicons from '@expo/vector-icons/Ionicons';
import { categoryLabel, formatMoney, type BudgetProgress } from '@budgetwise/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, focusRing, font, space } from '@/theme';
import { budgetStatusMeta } from './budgetStatus';
import { CategoryIcon, Meter } from './ui';
import type { InteractionState } from './ui/interaction';

export function BudgetRow({
  progress,
  onPress,
}: {
  progress: BudgetProgress;
  onPress?: () => void;
}) {
  const status = budgetStatusMeta(progress);
  const label = categoryLabel(progress.category);
  const body = (
    <>
      <View style={styles.top}>
        <CategoryIcon category={progress.category} size={32} />
        <Text style={styles.name} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.amounts}>
          <Text style={styles.spent}>{formatMoney(progress.spentCents)}</Text>
          <Text style={styles.of}> of {formatMoney(progress.limitCents)}</Text>
        </Text>
      </View>
      <Meter
        ratio={progress.ratio}
        color={status.color}
        pace={progress.paceRatio}
        label={`${label} budget used`}
      />
      <View style={styles.statusRow}>
        <Ionicons name={status.icon} size={16} color={status.color} />
        <Text style={styles.status}>{status.label}</Text>
        <Text style={styles.pct}>{Math.round(progress.ratio * 100)}%</Text>
      </View>
    </>
  );

  if (!onPress)
    return (
      <View style={styles.wrap} testID={`budget-${progress.category}`}>
        {body}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${formatMoney(progress.spentCents)} of ${formatMoney(progress.limitCents)}. ${status.label}`}
      accessibilityHint="Edit this budget"
      testID={`budget-${progress.category}`}
      style={(state) => {
        const s = state as InteractionState;
        return [
          styles.wrap,
          styles.pressable,
          (s.hovered || s.pressed) && styles.hover,
          s.focused && focusRing,
        ];
      }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, paddingVertical: space.sm },
  pressable: { paddingHorizontal: space.sm, marginHorizontal: -space.sm, borderRadius: 10 },
  hover: { backgroundColor: colors.surfaceAlt },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text },
  amounts: { fontSize: font.sm },
  spent: { fontWeight: '700', color: colors.text },
  of: { color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  status: { flex: 1, fontSize: font.xs, color: colors.textSecondary },
  pct: { fontSize: font.xs, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
});
