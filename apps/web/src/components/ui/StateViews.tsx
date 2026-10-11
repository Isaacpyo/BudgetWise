import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/theme';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.body}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} role="alert">
      <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.dangerText} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** Inline error line for forms and cards. */
export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.inline} role="alert">
      <Ionicons name="alert-circle" size={16} color={colors.dangerText} />
      <Text style={styles.inlineText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', maxWidth: 420 },
  action: { marginTop: space.sm },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
    backgroundColor: colors.dangerSoft,
    padding: space.md,
    borderRadius: 8,
  },
  inlineText: { flex: 1, fontSize: font.sm, color: colors.dangerText },
});
