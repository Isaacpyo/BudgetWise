import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, focusRing, font, radius, space } from '@/theme';
import type { InteractionState } from './interaction';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  /** Accessible name when it should differ from the visible label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const palette: Record<Variant, { bg: string; bgPressed: string; fg: string; border: string }> = {
  primary: {
    bg: colors.primary,
    bgPressed: colors.primaryPressed,
    fg: colors.textOnPrimary,
    border: colors.primary,
  },
  secondary: {
    bg: colors.surface,
    bgPressed: colors.surfaceAlt,
    fg: colors.text,
    border: colors.borderStrong,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.surfaceAlt,
    fg: colors.primary,
    border: 'transparent',
  },
  danger: {
    bg: colors.surface,
    bgPressed: colors.dangerSoft,
    fg: colors.dangerText,
    border: colors.dangerText,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  compact,
  style,
  testID,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      style={(state) => {
        const s = state as InteractionState;
        return [
          styles.base,
          compact && styles.compact,
          { backgroundColor: s.pressed || s.hovered ? p.bgPressed : p.bg, borderColor: p.border },
          inactive && styles.disabled,
          s.focused && focusRing,
          style,
        ];
      }}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={p.fg} />
        ) : icon ? (
          <Ionicons name={icon} size={compact ? 16 : 18} color={p.fg} />
        ) : null}
        <Text
          style={[styles.label, compact && styles.labelCompact, { color: p.fg }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  compact: { minHeight: 36, paddingHorizontal: space.md },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  label: { fontSize: font.md, fontWeight: '600' },
  labelCompact: { fontSize: font.sm },
  disabled: { opacity: 0.55 },
});
