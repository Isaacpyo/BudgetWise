import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, font, radius, space } from '@/theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  prefix?: string;
}

/** Labelled input with visible focus, hint and error states. */
export function TextField({ label, error, hint, prefix, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          {...input}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={styles.input}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" role="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
  boxFocused: { borderColor: colors.focus, borderWidth: 2, paddingHorizontal: space.md - 1 },
  boxError: { borderColor: colors.dangerText },
  prefix: { fontSize: font.md, color: colors.textSecondary, marginRight: space.xs },
  input: {
    flex: 1,
    fontSize: font.md,
    color: colors.text,
    paddingVertical: space.sm,
    // The focus ring is drawn on the container instead.
    outlineStyle: 'none',
  } as object,
  error: { fontSize: font.xs, color: colors.dangerText },
  hint: { fontSize: font.xs, color: colors.textMuted },
});
