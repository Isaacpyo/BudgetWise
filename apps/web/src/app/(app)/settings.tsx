import Ionicons from '@expo/vector-icons/Ionicons';
import type { HealthResponse, Item } from '@budgetwise/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  InlineError,
  LoadingState,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useSync } from '@/hooks/useSync';
import { api, errorMessage } from '@/lib/api';
import { config } from '@/lib/config';
import { confirmAction } from '@/lib/confirm';
import { timeAgo } from '@/lib/format';
import { colors, font, space } from '@/theme';

function ItemCard({ item }: { item: Item }) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlink() {
    const ok = await confirmAction(
      `Unlink ${item.institutionName}?`,
      'Its transactions will be removed from BudgetWise. Your rules and budgets stay.',
      'Unlink',
    );
    if (!ok) return;
    setRemoving(true);
    setError(null);
    try {
      await api.removeItem(item.id);
    } catch (err) {
      setError(errorMessage(err));
      setRemoving(false);
    }
  }

  const statusIcon =
    item.status === 'error'
      ? 'alert-circle'
      : item.status === 'syncing'
        ? 'sync'
        : 'checkmark-circle';
  const statusColor =
    item.status === 'error'
      ? colors.status.critical
      : item.status === 'syncing'
        ? colors.textMuted
        : colors.status.good;
  const statusText =
    item.status === 'error'
      ? (item.error ?? 'Sync failed')
      : item.status === 'syncing'
        ? 'Syncing…'
        : `Synced ${timeAgo(item.lastSyncedAt)}`;

  return (
    <View style={styles.item} testID="linked-item">
      <View style={styles.itemHead}>
        <Ionicons name="business-outline" size={22} color={colors.primary} />
        <View style={styles.itemText}>
          <Text style={styles.itemName}>{item.institutionName}</Text>
          <View style={styles.statusRow}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={styles.statusText}>{statusText}</Text>
            {item.provider === 'mock' ? (
              <Badge label="Sandbox simulation" />
            ) : (
              <Badge label="Plaid sandbox" tone="info" />
            )}
          </View>
        </View>
        <Button
          label="Unlink"
          variant="danger"
          compact
          onPress={unlink}
          loading={removing}
          accessibilityLabel={`Unlink ${item.institutionName}`}
        />
      </View>
      {item.accounts.map((a) => (
        <Text key={a.id} style={styles.account}>
          {a.name}
          {a.mask ? ` ••${a.mask}` : ''} · {a.subtype ?? a.type}
        </Text>
      ))}
      <InlineError message={error} />
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { items, rules, profile, loading, error, retry } = useData();
  const { sync, syncing, message, error: syncError } = useSync();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealthError(true));
  }, []);

  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (loading) return <LoadingState />;

  return (
    <Screen title="Accounts" testID="settings">
      <Card>
        <SectionHeader title="Linked banks" />
        {items.length === 0 ? (
          <Text style={styles.muted}>No banks linked yet.</Text>
        ) : (
          items.map((item) => <ItemCard key={item.id} item={item} />)
        )}
        <View style={styles.actions}>
          <Button
            label="Link a bank"
            icon="add"
            onPress={() => router.push('/link-bank')}
            testID="link-bank"
          />
          {items.length ? (
            <Button
              label="Sync now"
              icon="sync"
              variant="secondary"
              onPress={sync}
              loading={syncing}
            />
          ) : null}
        </View>
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <InlineError message={syncError} />
      </Card>

      <Card>
        <SectionHeader title="Categorisation rules" />
        <Text style={styles.muted}>
          {rules.length
            ? `${rules.length} rule${rules.length === 1 ? '' : 's'} sort your transactions before Plaid's categories are used.`
            : 'Rules let you decide how merchants are categorised, past and future.'}
        </Text>
        <Button
          label="Manage rules"
          icon="options-outline"
          variant="secondary"
          onPress={() => router.push('/rules')}
          testID="manage-rules"
        />
      </Card>

      <Card>
        <SectionHeader title="Profile" />
        <View style={styles.profileRow}>
          <Text style={styles.email}>
            {profile?.isDemo ? 'Demo account' : (user?.email ?? 'Signed in')}
          </Text>
          {profile?.isDemo ? <Badge label="Resets every few hours" tone="warning" /> : null}
        </View>
        <Button
          label="Sign out"
          icon="log-out-outline"
          variant="secondary"
          onPress={() => void signOut()}
          testID="sign-out"
        />
      </Card>

      <Card>
        <SectionHeader title="About" />
        <Text style={styles.muted}>
          API:{' '}
          {health
            ? `online · ${health.provider === 'plaid' ? 'Plaid sandbox' : 'built-in sandbox bank'} · v${health.version}`
            : healthError
              ? 'unreachable'
              : 'checking…'}
        </Text>
        <Text style={styles.muted}>
          BudgetWise is a portfolio project. All bank data is sandbox data; no real accounts are
          ever connected.
        </Text>
        <Button
          label="Source on GitHub"
          variant="ghost"
          icon="logo-github"
          compact
          onPress={() => void Linking.openURL(config.repoUrl)}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: font.sm, color: colors.textSecondary },
  success: { fontSize: font.sm, color: colors.successText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  statusText: { fontSize: font.xs, color: colors.textSecondary },
  account: { fontSize: font.sm, color: colors.textSecondary, marginLeft: 34 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  email: { fontSize: font.md, color: colors.text, fontWeight: '600' },
});
