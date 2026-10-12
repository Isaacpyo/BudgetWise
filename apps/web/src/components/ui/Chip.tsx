import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, focusRing, font, radius, space } from '@/theme';
import type { InteractionState } from './interaction';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      style={(state) => {
        const s = state as InteractionState;
        return [
          styles.chip,
          selected && styles.selected,
          !selected && (s.hovered || s.pressed) && styles.hover,
          s.focused && focusRing,
        ];
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? colors.textOnPrimary : colors.textSecondary}
        />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  hover: { backgroundColor: colors.surfaceAlt },
  label: { fontSize: font.sm, color: colors.text },
  labelSelected: { color: colors.textOnPrimary, fontWeight: '600' },
});
