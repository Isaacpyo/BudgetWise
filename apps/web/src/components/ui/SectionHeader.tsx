import { Link, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/theme';

export function SectionHeader({
  title,
  linkLabel,
  href,
}: {
  title: string;
  linkLabel?: string;
  href?: Href;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {linkLabel && href ? (
        <Link href={href} style={styles.link} accessibilityRole="link">
          {linkLabel}
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  link: { fontSize: font.sm, fontWeight: '600', color: colors.primary, paddingVertical: space.xs },
});
