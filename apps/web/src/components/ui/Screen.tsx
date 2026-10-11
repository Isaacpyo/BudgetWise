import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, font, MAX_CONTENT_WIDTH, space } from '@/theme';

/** Scrollable page with a centred, max-width column (375px phones up to desktop). */
export function Screen({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
  testID,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  testID?: string;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID={testID}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <View style={styles.column}>
        {title ? (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.page },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xxl * 2 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.md,
  },
  headerText: { flexShrink: 1, gap: 2 },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.sm, color: colors.textSecondary },
});
