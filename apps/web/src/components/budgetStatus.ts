import type { BudgetProgress } from '@budgetwise/core';
import { formatMoney } from '@budgetwise/core';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { colors } from '@/theme';

/** Status colours are reserved and always paired with an icon and words. */
export function budgetStatusMeta(p: BudgetProgress): {
  color: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
} {
  if (p.status === 'over') {
    return {
      color: colors.status.critical,
      icon: 'alert-circle',
      label: `Over by ${formatMoney(p.spentCents - p.limitCents)}`,
    };
  }
  if (p.status === 'warning') {
    return {
      color: colors.status.serious,
      icon: 'warning',
      label: `${formatMoney(p.remainingCents)} left`,
    };
  }
  if (p.paceRatio != null && p.ratio > p.paceRatio + 0.1) {
    return {
      color: colors.status.warning,
      icon: 'speedometer',
      label: `Ahead of pace · ${formatMoney(p.remainingCents)} left`,
    };
  }
  return {
    color: colors.status.good,
    icon: 'checkmark-circle',
    label: `${formatMoney(p.remainingCents)} left`,
  };
}
