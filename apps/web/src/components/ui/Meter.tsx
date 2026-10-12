import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';

export interface MeterProps {
  /** 0–1+, values above 1 render full. */
  ratio: number;
  color: string;
  /** Optional "expected by today" marker, 0–1. */
  pace?: number | null;
  label: string;
}

/** A single-ratio meter (budget used vs limit) with an optional pace tick. */
export function Meter({ ratio, color, pace, label }: MeterProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      {pace != null ? (
        <View
          style={[styles.pace, { left: `${Math.max(0, Math.min(1, pace)) * 100}%` }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  pace: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.text,
    borderRadius: 1,
  },
});
