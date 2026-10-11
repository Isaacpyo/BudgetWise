import Ionicons from '@expo/vector-icons/Ionicons';
import type { ExchangeResponse, LinkTokenResponse } from '@budgetwise/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MockBankSheet } from '@/components/plaid/MockBankSheet';
import { completionRedirectUri, linkMode, runPlaidLink } from '@/components/plaid/plaidLink';
import { Button, Card, ErrorState, LoadingState, Screen } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { colors, font, space } from '@/theme';

type Phase =
  | { name: 'preparing' }
  | { name: 'ready'; token: LinkTokenResponse }
  | { name: 'linking' }
  | { name: 'importing' }
  | { name: 'done'; result: ExchangeResponse }
  | { name: 'cancelled'; message: string | null }
  | { name: 'error'; message: string };

export default function LinkBankScreen() {
  const [phase, setPhase] = useState<Phase>({ name: 'preparing' });

  const fetchToken = useCallback(async (): Promise<Phase> => {
    try {
      const token = await api.linkToken({
        mode: linkMode,
        ...(linkMode === 'hosted' ? { completionRedirectUri: completionRedirectUri() } : {}),
      });
      return { name: 'ready', token };
    } catch (err) {
      return { name: 'error', message: errorMessage(err) };
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchToken().then((next) => active && setPhase(next));
    return () => {
      active = false;
    };
  }, [fetchToken]);

  function prepare() {
    setPhase({ name: 'preparing' });
    void fetchToken().then(setPhase);
  }

  async function exchange(
    publicToken: string,
    institution: { id: string | null; name: string } | null,
  ) {
    setPhase({ name: 'importing' });
    try {
      const result = await api.exchange({ publicToken, institution });
      setPhase({ name: 'done', result });
    } catch (err) {
      setPhase({ name: 'error', message: errorMessage(err) });
    }
  }

  async function openPlaid(token: LinkTokenResponse) {
    setPhase({ name: 'linking' });
    try {
      const outcome = await runPlaidLink(token);
      if (outcome.kind === 'publicToken') {
        await exchange(outcome.publicToken, outcome.institution);
      } else if (outcome.kind === 'hostedFinished') {
        setPhase({ name: 'importing' });
        try {
          setPhase({ name: 'done', result: await api.completeHostedLink(token.linkToken) });
        } catch (err) {
          if (err instanceof ApiError && err.code === 'LINK_NOT_COMPLETED') {
            setPhase({ name: 'cancelled', message: null });
          } else {
            throw err;
          }
        }
      } else {
        setPhase({ name: 'cancelled', message: outcome.message });
      }
    } catch (err) {
      setPhase({ name: 'error', message: errorMessage(err) });
    }
  }

  return (
    <Screen testID="link-bank-screen">
      <View style={styles.intro}>
        <Text style={styles.title} accessibilityRole="header">
          Connect a bank
        </Text>
        <Text style={styles.body}>
          BudgetWise uses Plaid in sandbox mode: you connect a test bank, never a real account. We
          store an encrypted access token on our server and import about five months of
          transactions.
        </Text>
      </View>

      <Card>
        {phase.name === 'preparing' ? <LoadingState label="Preparing a secure link…" /> : null}

        {phase.name === 'ready' && phase.token.provider === 'mock' ? (
          <MockBankSheet busy={false} onConnect={(token, inst) => void exchange(token, inst)} />
        ) : null}

        {phase.name === 'ready' && phase.token.provider === 'plaid' ? (
          <View style={styles.stack}>
            <View style={styles.tip}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={styles.tipText}>
                In Plaid&apos;s sandbox pick any bank (e.g. First Platypus Bank) and sign in with{' '}
                <Text style={styles.code}>user_good</Text> /{' '}
                <Text style={styles.code}>pass_good</Text>. For richer data use{' '}
                <Text style={styles.code}>user_transactions_dynamic</Text> with any password.
              </Text>
            </View>
            <Button
              label="Continue to Plaid"
              icon="open-outline"
              onPress={() => void openPlaid(phase.token)}
              testID="open-plaid"
            />
          </View>
        ) : null}

        {phase.name === 'linking' ? <LoadingState label="Waiting for Plaid Link…" /> : null}
        {phase.name === 'importing' ? (
          <LoadingState label="Importing and categorising transactions…" />
        ) : null}

        {phase.name === 'done' ? (
          <View style={styles.stack} testID="link-success">
            <View style={styles.doneHead}>
              <Ionicons name="checkmark-circle" size={28} color={colors.status.good} />
              <Text style={styles.doneTitle}>Linked {phase.result.item.institutionName}</Text>
            </View>
            <Text style={styles.body}>
              {phase.result.sync.added > 0
                ? `Imported ${phase.result.sync.added} transactions and sorted them into categories.`
                : phase.result.sync.ready
                  ? 'No transactions yet. New ones will appear when you sync.'
                  : 'Plaid is still preparing this bank’s history. Tap “Sync now” on the Overview in a minute.'}
            </Text>
            <View style={styles.actions}>
              <Button
                label="View transactions"
                onPress={() => router.replace('/transactions')}
                testID="view-transactions"
              />
              <Button label="Done" variant="secondary" onPress={() => router.back()} />
            </View>
          </View>
        ) : null}

        {phase.name === 'cancelled' ? (
          <View style={styles.stack}>
            <Text style={styles.body}>
              {phase.message ?? 'Linking was cancelled. No bank was connected.'}
            </Text>
            <View style={styles.actions}>
              <Button label="Try again" icon="refresh" onPress={prepare} />
              <Button label="Close" variant="secondary" onPress={() => router.back()} />
            </View>
          </View>
        ) : null}

        {phase.name === 'error' ? <ErrorState message={phase.message} onRetry={prepare} /> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  body: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  stack: { gap: space.md },
  tip: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: 10,
  },
  tipText: { flex: 1, fontSize: font.sm, color: colors.text, lineHeight: 20 },
  code: { fontFamily: 'monospace', fontWeight: '600' },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  doneTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
