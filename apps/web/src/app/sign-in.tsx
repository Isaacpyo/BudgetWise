import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Card, InlineError, TextField } from '@/components/ui';
import type { InteractionState } from '@/components/ui/interaction';
import { useAuth } from '@/context/AuthContext';
import { errorMessage } from '@/lib/api';
import { authErrorMessage, validateCredentials } from '@/lib/auth-errors';
import { colors, focusRing, font, radius, space } from '@/theme';

type Mode = 'signIn' | 'signUp';

const FEATURES: Array<[keyof typeof Ionicons.glyphMap, string]> = [
  ['link-outline', 'Link a sandbox bank through Plaid Link'],
  ['pricetags-outline', 'Auto-categorised transactions with rules you control'],
  ['pie-chart-outline', 'Monthly budgets with live progress'],
  ['bar-chart-outline', 'Spending trends and pace charts'],
];

export default function SignInScreen() {
  const { signIn, signUp, signInDemo, resetPassword } = useAuth();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'form' | 'demo' | 'reset' | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    const errors = validateCredentials(email, password, mode);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    setBusy('form');
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function demo() {
    setError(null);
    setNotice(null);
    setBusy('demo');
    try {
      await signInDemo();
    } catch (err) {
      setError(`Couldn't start the demo: ${errorMessage(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function forgot() {
    setError(null);
    const errors = validateCredentials(email, 'x', 'signIn');
    if (errors.email) {
      setFieldErrors({ email: 'Enter your email above, then tap "Forgot password".' });
      return;
    }
    setBusy('reset');
    try {
      await resetPassword(email);
      setNotice('If that email has an account, a reset link is on its way.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.layout, wide && styles.layoutWide]}>
          <View style={[styles.pitch, wide && styles.pitchWide]}>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>BW</Text>
              </View>
              <Text style={styles.brandName}>BudgetWise</Text>
            </View>
            <Text style={styles.headline} accessibilityRole="header">
              Know where your money goes.
            </Text>
            <Text style={styles.lede}>
              Connect a bank, let BudgetWise sort every transaction, and keep each month on budget.
            </Text>
            <View style={styles.features}>
              {FEATURES.map(([icon, text]) => (
                <View key={text} style={styles.feature}>
                  <Ionicons name={icon} size={18} color={colors.primary} />
                  <Text style={styles.featureText}>{text}</Text>
                </View>
              ))}
            </View>
          </View>

          <Card style={[styles.card, wide && styles.cardWide]}>
            <Button
              label="Try the demo"
              icon="sparkles"
              onPress={demo}
              loading={busy === 'demo'}
              disabled={!!busy && busy !== 'demo'}
              accessibilityHint="Signs in to a shared demo account with sample data"
              testID="try-demo"
            />
            <Text style={styles.demoHint}>
              One click, no sign-up: a demo account with six months of sandbox data.
            </Text>

            <View style={styles.divider}>
              <View style={styles.rule} />
              <Text style={styles.dividerText}>or use your email</Text>
              <View style={styles.rule} />
            </View>

            <View style={styles.tabs} accessibilityRole="tablist">
              {(['signIn', 'signUp'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setError(null);
                    setFieldErrors({});
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m }}
                  style={(state) => {
                    const s = state as InteractionState;
                    return [styles.tab, mode === m && styles.tabActive, s.focused && focusRing];
                  }}
                >
                  <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                    {m === 'signIn' ? 'Sign in' : 'Create account'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="you@example.com"
              error={fieldErrors.email}
              returnKeyType="next"
              testID="email"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              placeholder={mode === 'signUp' ? 'At least 8 characters' : undefined}
              error={fieldErrors.password}
              onSubmitEditing={submit}
              returnKeyType="go"
              testID="password"
            />

            <InlineError message={error} />
            {notice ? (
              <Text style={styles.notice} accessibilityLiveRegion="polite">
                {notice}
              </Text>
            ) : null}

            <Button
              label={mode === 'signIn' ? 'Sign in' : 'Create account'}
              variant="secondary"
              onPress={submit}
              loading={busy === 'form'}
              disabled={!!busy && busy !== 'form'}
              testID="submit-auth"
            />
            {mode === 'signIn' ? (
              <Button
                label="Forgot password?"
                variant="ghost"
                compact
                onPress={forgot}
                loading={busy === 'reset'}
              />
            ) : null}
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  layout: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: space.xl },
  layoutWide: { flexDirection: 'row', alignItems: 'center', gap: space.xxl * 2 },
  pitch: { gap: space.md },
  pitchWide: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logo: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  logoText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: font.md },
  brandName: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  headline: { fontSize: font.hero, fontWeight: '800', color: colors.text, lineHeight: 42 },
  lede: { fontSize: font.md, color: colors.textSecondary, lineHeight: 24, maxWidth: 480 },
  features: { gap: space.sm, marginTop: space.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  featureText: { fontSize: font.sm, color: colors.text, flexShrink: 1 },
  card: { gap: space.md },
  cardWide: { width: 420 },
  demoHint: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.xs },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: font.xs, color: colors.textMuted },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabText: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  notice: { fontSize: font.sm, color: colors.successText },
});
