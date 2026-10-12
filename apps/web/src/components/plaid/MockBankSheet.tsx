import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import type { InteractionState } from '@/components/ui/interaction';
import { colors, focusRing, font, radius, space } from '@/theme';

export const MOCK_INSTITUTIONS = [
  { id: 'ins_mock_platypus', name: 'First Platypus Bank', blurb: 'Checking + rewards card' },
  { id: 'ins_mock_tartan', name: 'Tartan Bank', blurb: 'Everyday banking' },
  { id: 'ins_mock_houndstooth', name: 'Houndstooth Bank', blurb: 'Online bank' },
] as const;

/**
 * Stand-in for Plaid Link when the API runs PLAID_PROVIDER=mock (local dev,
 * tests, or a deployment without Plaid keys). Produces a mock public token
 * that only the mock provider accepts.
 */
export function MockBankSheet({
  onConnect,
  busy,
}: {
  onConnect: (publicToken: string, institution: { id: string; name: string }) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string>(MOCK_INSTITUTIONS[0].id);
  const institution = MOCK_INSTITUTIONS.find((i) => i.id === selected) ?? MOCK_INSTITUTIONS[0];

  return (
    <View style={styles.wrap} testID="mock-bank-sheet">
      <View style={styles.notice}>
        <Ionicons name="flask-outline" size={18} color={colors.primary} />
        <Text style={styles.noticeText}>
          Sandbox simulation. This server runs the built-in mock bank, so no real or Plaid
          credentials are involved.
        </Text>
      </View>
      <Text style={styles.heading} accessibilityRole="header">
        Select your bank
      </Text>
      <View accessibilityRole="radiogroup" style={styles.list}>
        {MOCK_INSTITUTIONS.map((inst) => {
          const isSelected = inst.id === selected;
          return (
            <Pressable
              key={inst.id}
              onPress={() => setSelected(inst.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={inst.name}
              style={(state) => {
                const s = state as InteractionState;
                return [
                  styles.option,
                  isSelected && styles.optionSelected,
                  (s.hovered || s.pressed) && !isSelected && styles.optionHover,
                  s.focused && focusRing,
                ];
              }}
            >
              <Ionicons name="business-outline" size={22} color={colors.primary} />
              <View style={styles.optionText}>
                <Text style={styles.optionName}>{inst.name}</Text>
                <Text style={styles.optionBlurb}>{inst.blurb}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isSelected ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.creds}>Sandbox credentials: user_good / pass_good (pre-filled)</Text>
      <Button
        label={`Connect ${institution.name}`}
        icon="link"
        loading={busy}
        onPress={() =>
          onConnect(`public-mock-${institution.id}-${Date.now().toString(36)}`, {
            id: institution.id,
            name: institution.name,
          })
        }
        testID="mock-connect"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  notice: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: colors.primarySoft,
    padding: space.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1, fontSize: font.sm, color: colors.text },
  heading: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  list: { gap: space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    minHeight: 56,
  },
  optionSelected: { borderColor: colors.primary, borderWidth: 2, padding: space.md - 1 },
  optionHover: { backgroundColor: colors.surfaceAlt },
  optionText: { flex: 1 },
  optionName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  optionBlurb: { fontSize: font.xs, color: colors.textSecondary },
  creds: { fontSize: font.xs, color: colors.textMuted },
});
