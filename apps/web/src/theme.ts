/**
 * Design tokens. Chart colours follow the dataviz rules: one accent hue for the
 * series that matters, recessive grey for context, and reserved status
 * colours that always ship with an icon and a label.
 */
export const colors = {
  page: '#f6f7f5',
  surface: '#ffffff',
  surfaceAlt: '#f0f2ef',
  border: 'rgba(11,11,11,0.10)',
  borderStrong: 'rgba(11,11,11,0.18)',

  text: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#6b6a65',
  textOnPrimary: '#ffffff',

  primary: '#0f766e',
  primaryPressed: '#115e59',
  primarySoft: '#e6f4f1',

  accent: '#2a78d6',
  context: '#c3c2b7',
  grid: '#e1e0d9',
  axis: '#898781',

  successText: '#006300',
  dangerText: '#b42318',
  dangerSoft: '#fdecea',

  status: {
    good: '#0ca30c',
    warning: '#fab219',
    serious: '#ec835a',
    critical: '#d03b3b',
  },

  focus: '#2a78d6',
  overlay: 'rgba(11,11,11,0.45)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export const font = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 36,
} as const;

/** Content never stretches wider than this on desktop. */
export const MAX_CONTENT_WIDTH = 960;

/** Visible focus ring for keyboard users on web. */
export const focusRing = {
  outlineColor: colors.focus,
  outlineStyle: 'solid',
  outlineWidth: 2,
  outlineOffset: 2,
} as const;
