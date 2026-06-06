import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Signal } from '../types';
import { colors, radius, spacing, fontSize } from '../theme';

interface SignalItemProps {
  signal: Signal;
  showPoints?: boolean;
}

export default function SignalItem({ signal, showPoints = true }: SignalItemProps) {
  const [expanded, setExpanded] = useState(false);

  const isNegative = signal.points < 0;
  const pointsColor = isNegative ? colors.safe : colors.highRisk;
  const pointsBg = isNegative ? '#22C55E1A' : '#EF44441A';
  const pointsLabel = isNegative ? `${signal.points}` : `+${signal.points}`;

  const severityDot: Record<string, string> = {
    critical: colors.highRisk,
    high: '#FB923C',
    medium: colors.caution,
    low: colors.safe,
  };

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      activeOpacity={0.75}
      style={styles.container}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{signal.icon}</Text>
        <View style={[styles.severityDot, { backgroundColor: severityDot[signal.severity] }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name}>{signal.name}</Text>
        <Text
          style={styles.description}
          numberOfLines={expanded ? undefined : 2}
        >
          {signal.description}
        </Text>
        {signal.description.length > 80 && (
          <Text style={styles.expandHint}>{expanded ? 'Show less' : 'Show more'}</Text>
        )}
      </View>

      {/* Points badge */}
      {showPoints && (
        <View style={[styles.pointsBadge, { backgroundColor: pointsBg }]}>
          <Text style={[styles.pointsText, { color: pointsColor }]}>{pointsLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  icon: {
    fontSize: 20,
  },
  severityDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.bgCard,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  expandHint: {
    fontSize: fontSize.xs,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
    flexShrink: 0,
  },
  pointsText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
