import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMonth } from '@budgetwise/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, focusRing, font, radius, space } from '@/theme';
import type { InteractionState } from './interaction';

export function MonthPicker({
  month,
  months,
  onChange,
}: {
  month: string;
  months: readonly string[];
  onChange: (month: string) => void;
}) {
  const index = months.indexOf(month);
  const prev = index > 0 ? months[index - 1] : undefined;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;

  const arrow = (target: string | undefined, dir: 'back' | 'forward') => (
    <Pressable
      onPress={() => target && onChange(target)}
      disabled={!target}
      accessibilityRole="button"
      accessibilityLabel={dir === 'back' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !target }}
      hitSlop={8}
      style={(state) => {
        const s = state as InteractionState;
        return [
          styles.arrow,
          (s.hovered || s.pressed) && !!target && styles.arrowHover,
          s.focused && focusRing,
        ];
      }}
    >
      <Ionicons
        name={dir === 'back' ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={target ? colors.text : colors.context}
      />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {arrow(prev, 'back')}
      <Text style={styles.label} accessibilityLiveRegion="polite" testID="month-label">
        {formatMonth(month)}
      </Text>
      {arrow(next, 'forward')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowHover: { backgroundColor: colors.surfaceAlt },
  label: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
    minWidth: 84,
    textAlign: 'center',
  },
});
