// Centralized tokens for the refined dark + emerald UI seen in the latest iOS mocks.
// Keep this file ASCII-only to avoid font issues in native builds.

export const bpsThemeV2 = {
  colors: {
    bg: '#020617',
    bgAlt: '#0b1427',
    card: '#020617',
    cardElevated: '#091326',
    border: 'rgba(148,163,184,0.20)',
    divider: 'rgba(148,163,184,0.10)',
    textPrimary: '#ffffff',
    textSecondary: '#f3f4f6',
    textMuted: '#e5e7eb',
    textDisabled: 'rgba(243,244,246,0.65)',
    accent: '#22c55e',
    accentCyan: '#22d3ee',
    accentSoft: 'rgba(34,197,94,0.12)',
    warning: '#f59e0b',
    danger: '#ef4444',
    success: '#22c55e',
    shadow: 'rgba(0,0,0,0.45)',
  },
  gradients: {
    primary: ['#22c55e', '#22d3ee'],
    card: ['#081020', '#0c1427'],
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    xl: 24,
    pill: 999,
  },
  text: {
    titleXL: { fontSize: 28, fontWeight: '800' as const, letterSpacing: 0.2 },
    title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: 0.15 },
    subtitle: { fontSize: 16, fontWeight: '600' as const },
    body: { fontSize: 14, fontWeight: '500' as const },
    small: { fontSize: 12, fontWeight: '500' as const },
  },
  shadows: {
    card: {
      shadowColor: 'rgba(0,0,0,0.65)',
      shadowOpacity: 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
    soft: {
      shadowColor: 'rgba(0,0,0,0.45)',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  },
} as const;

export type BpsThemeV2 = typeof bpsThemeV2;

