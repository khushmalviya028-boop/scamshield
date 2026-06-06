import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RBIGate } from '../types';
import { colors, spacing, fontSize } from '../theme';

interface GateBannerProps {
  gate: RBIGate;
  banner: string;
  details: string;
}

const GATE_CONFIG: Record<
  RBIGate,
  { icon: string; bg: string; border: string; textColor: string }
> = {
  authorized: {
    icon: '✅',
    bg: '#22C55E18',
    border: '#22C55E40',
    textColor: colors.safe,
  },
  unverified: {
    icon: '🚫',
    bg: '#EF444418',
    border: '#EF444440',
    textColor: colors.highRisk,
  },
  unauthorized: {
    icon: '❌',
    bg: '#EF444418',
    border: '#EF444440',
    textColor: colors.highRisk,
  },
  na: {
    icon: 'ℹ️',
    bg: '#64748B18',
    border: '#64748B40',
    textColor: colors.textMuted,
  },
};

export default function GateBanner({ gate, banner, details }: GateBannerProps) {
  const config = GATE_CONFIG[gate];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Text style={styles.gateIcon}>{config.icon}</Text>
      <View style={styles.textGroup}>
        <Text style={[styles.bannerText, { color: config.textColor }]}>{banner}</Text>
        <Text style={styles.detailsText}>{details}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderWidth: 0,
    borderBottomWidth: 2,
    gap: spacing.sm,
  },
  gateIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  textGroup: {
    flex: 1,
    gap: 4,
  },
  bannerText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailsText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
