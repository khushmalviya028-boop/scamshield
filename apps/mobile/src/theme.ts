export const colors = {
  bg: '#0B0F1A',
  bgCard: '#141826',
  bgInput: '#1E2436',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  safe: '#22C55E',
  caution: '#F59E0B',
  highRisk: '#EF4444',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  border: '#1E2436',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 40,
};

export const gradients = {
  hero: ['#0B0F1A', '#141826', '#0B0F1A'] as const,
  safe: ['#052e16', '#166534', '#052e16'] as const,
  caution: ['#451a03', '#92400e', '#451a03'] as const,
  highRisk: ['#450a0a', '#991b1b', '#450a0a'] as const,
  primary: ['#312e81', '#4338ca', '#6366f1'] as const,
  card: ['#141826', '#1a2033'] as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  }),
};

export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  gradients,
  shadows,
};

export default theme;
