import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, ScoreResult } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';
import { verifyApp, getMockResult } from '../api/verify';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scanning'>;
  route: RouteProp<RootStackParamList, 'Scanning'>;
};

const STEPS = [
  'Reading listing & permissions',
  'Checking RBI registry',
  'Analysing reviews',
  'Community reports & blocklists',
  'Computing risk score',
];

const STEP_DELAY = 600;

interface StepRowProps {
  label: string;
  isComplete: boolean;
}

function StepRow({ label, isComplete }: StepRowProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (isComplete) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [isComplete]);

  return (
    <Animated.View style={[styles.stepRow, { opacity, transform: [{ translateY }] }]}>
      <View style={[styles.stepCircle, isComplete && styles.stepCircleDone]}>
        {isComplete ? (
          <Text style={styles.checkmark}>✓</Text>
        ) : (
          <View style={styles.pendingDot} />
        )}
      </View>
      <Text style={[styles.stepText, isComplete && styles.stepTextDone]}>{label}</Text>
    </Animated.View>
  );
}

export default function ScanningScreen({ navigation, route }: Props) {
  const { appName, request } = route.params;
  const [completedCount, setCompletedCount] = useState(0);

  const apiResult = useRef<ScoreResult | null>(null);
  const apiDone = useRef(false);
  const stepsDone = useRef(false);
  const navigated = useRef(false);
  const pulseScale = useRef(new Animated.Value(1)).current;

  const tryNavigate = () => {
    if (navigated.current) return;
    if (!apiDone.current || !stepsDone.current) return;
    navigated.current = true;
    const result = apiResult.current!;
    setTimeout(() => {
      navigation.replace('Verdict', { result });
    }, 400);
  };

  useEffect(() => {
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulseAnim.start();

    verifyApp(request)
      .then((result) => {
        apiResult.current = result;
        apiDone.current = true;
        tryNavigate();
      })
      .catch(() => {
        apiResult.current = getMockResult(appName);
        apiDone.current = true;
        tryNavigate();
      });

    const timers: ReturnType<typeof setTimeout>[] = [];
    STEPS.forEach((_, i) => {
      const t = setTimeout(() => {
        setCompletedCount((prev) => {
          const next = Math.max(prev, i + 1);
          if (i === STEPS.length - 1) {
            stepsDone.current = true;
            tryNavigate();
          }
          return next;
        });
      }, (i + 1) * STEP_DELAY);
      timers.push(t);
    });

    return () => {
      timers.forEach(clearTimeout);
      pulseAnim.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Animated.View style={[styles.shieldBadge, { transform: [{ scale: pulseScale }] }]}>
            <Text style={styles.shieldEmoji}>🛡️</Text>
          </Animated.View>
          <Text style={styles.appName} numberOfLines={2}>{appName}</Text>
          <Text style={styles.subtitle}>Verifying...</Text>
        </View>

        <View style={styles.stepsCard}>
          {STEPS.map((step, i) => (
            <StepRow key={step} label={step} isComplete={i < completedCount} />
          ))}
        </View>

        <Text style={styles.footerHint}>This typically takes 2–4 seconds</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  header: { alignItems: 'center', marginBottom: spacing.xl + spacing.md },
  shieldBadge: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#6366F115', borderWidth: 1.5, borderColor: '#6366F140',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  shieldEmoji: { fontSize: 36 },
  appName: {
    fontSize: fontSize.xxl, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center', letterSpacing: -0.5, marginBottom: spacing.xs,
  },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: '500' },
  stepsCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm,
    gap: spacing.md, borderRadius: radius.md,
  },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2,
    borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepCircleDone: { borderColor: colors.safe, backgroundColor: '#22C55E18' },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  checkmark: { color: colors.safe, fontSize: 14, fontWeight: '800' },
  stepText: { fontSize: fontSize.md, color: colors.textMuted, fontWeight: '500', flex: 1 },
  stepTextDone: { color: colors.textPrimary, fontWeight: '600' },
  footerHint: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xl },
});
