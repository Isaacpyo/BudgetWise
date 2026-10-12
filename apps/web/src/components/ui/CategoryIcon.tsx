import Ionicons from '@expo/vector-icons/Ionicons';
import { CATEGORIES, type CategoryId } from '@budgetwise/core';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function categoryIconName(category: CategoryId): IconName {
  return CATEGORIES[category].icon as IconName;
}

/** Neutral, single-tint icon: identity comes from the label, never colour alone. */
export function CategoryIcon({ category, size = 36 }: { category: CategoryId; size?: number }) {
  return (
    <View
      style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Ionicons name={categoryIconName(category)} size={size * 0.5} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
