import {
  CATEGORIES,
  formatDay,
  formatMoney,
  formatMonth,
  normalizeText,
  type CategoryId,
  type Transaction,
} from '@budgetwise/core';
import { useMemo, useState } from 'react';
import { ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { TransactionRow } from '@/components/TransactionRow';
import {
  categoryIconName,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  MonthPicker,
  TextField,
} from '@/components/ui';
import { useData } from '@/context/DataContext';
import { colors, font, MAX_CONTENT_WIDTH, space } from '@/theme';

export default function TransactionsScreen() {
  const { transactions, month, months, setMonth, loading, error, retry } = useData();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);

  const inMonth = useMemo(
    () => transactions.filter((t) => t.month === month),
    [transactions, month],
  );
  const presentCategories = useMemo(
    () =>
      [...new Set(inMonth.map((t) => t.category))].sort((a, b) =>
        CATEGORIES[a].label.localeCompare(CATEGORIES[b].label),
      ),
    [inMonth],
  );

  const filtered = useMemo(() => {
    const q = normalizeText(search);
    return inMonth.filter(
      (t) =>
        (!category || t.category === category) &&
        (!q || normalizeText(`${t.merchantName ?? ''} ${t.name}`).includes(q)),
    );
  }, [inMonth, search, category]);

  const sections = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const t of filtered) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
    return [...byDate.entries()].map(([date, data]) => ({ date, data }));
  }, [filtered]);

  const spent = filtered.reduce(
    (s, t) => (CATEGORIES[t.category].kind === 'expense' ? s + t.amountCents : s),
    0,
  );

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) return <LoadingState label="Loading transactions…" />;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          Transactions
        </Text>
        <MonthPicker month={month} months={months} onChange={setMonth} />
      </View>
      <TextField
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Merchant or description"
        autoCapitalize="none"
        returnKeyType="search"
        testID="search"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {presentCategories.map((id) => (
          <Chip
            key={id}
            label={CATEGORIES[id].label}
            icon={categoryIconName(id)}
            selected={category === id}
            onPress={() => setCategory(category === id ? null : id)}
          />
        ))}
      </ScrollView>
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {filtered.length} transaction{filtered.length === 1 ? '' : 's'} ·{' '}
        {formatMoney(Math.max(0, spent))} spent
      </Text>
    </View>
  );

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader} accessibilityRole="header">
          {formatDay(section.date)}
        </Text>
      )}
      renderItem={({ item }) => <TransactionRow tx={item} showDate={false} />}
      ListEmptyComponent={
        <EmptyState
          icon="receipt-outline"
          title={
            search || category ? 'No matching transactions' : `Nothing in ${formatMonth(month)}`
          }
          body={
            search || category
              ? 'Try a different search or category.'
              : 'Pick another month or link a bank.'
          }
        />
      }
      keyboardShouldPersistTaps="handled"
      testID="transactions-list"
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.page },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl * 2,
  },
  header: { gap: space.md, marginBottom: space.sm },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.md,
  },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  chips: { gap: space.sm, paddingVertical: 2 },
  count: { fontSize: font.sm, color: colors.textSecondary },
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
});
