import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, RiskBand } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';
import RiskGauge from '../components/RiskGauge';
import SignalItem from '../components/SignalItem';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Verdict'>;
  route: RouteProp<RootStackParamList, 'Verdict'>;
};

const BAND_COLOR: Record<RiskBand, string> = {
  safe: colors.safe,
  caution: colors.caution,
  'high-risk': colors.highRisk,
};

const BAND_GRADIENT: Record<RiskBand, readonly [string, string, string]> = {
  safe: ['#052e16', '#0a3d1c', '#0B0F1A'],
  caution: ['#451a03', '#3a1800', '#0B0F1A'],
  'high-risk': ['#450a0a', '#2d0505', '#0B0F1A'],
};

const BAND_LABEL: Record<RiskBand, string> = {
  safe: 'LIKELY SAFE',
  caution: 'EXERCISE CAUTION',
  'high-risk': 'HIGH RISK',
};

const BAND_ICON: Record<RiskBand, string> = {
  safe: '✅',
  caution: '⚠️',
  'high-risk': '🚨',
};

const GATE_CONFIG: Record<string, { bg: string; border: string; textColor: string; icon: string }> = {
  authorized: { bg: '#22C55E18', border: '#22C55E35', textColor: colors.safe, icon: '✅' },
  unverified: { bg: '#EF444418', border: '#EF444435', textColor: colors.highRisk, icon: '🚫' },
  unauthorized: { bg: '#EF444418', border: '#EF444435', textColor: colors.highRisk, icon: '🚫' },
  na: { bg: '#64748B18', border: '#64748B35', textColor: colors.textMuted, icon: 'ℹ️' },
};

export default function VerdictScreen({ navigation, route }: Props) {
  const { result } = route.params;
  const band = result.band ?? 'high-risk';
  const bandColor = BAND_COLOR[band];
  const gate = GATE_CONFIG[result.gate] ?? GATE_CONFIG.na;

  const handleTakeDown = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('TakeDown', { result });
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Report', { appName: result.appName, packageId: result.packageId });
  };

  const handleVerifyAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Home');
  };

  const handleEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    navigation.navigate('Emergency');
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const icon = BAND_ICON[band];
    await Share.share({
      message: `${icon} ScamShield: ${result.appName}\nScore: ${result.score}/100 — ${result.verdictLabel}\n\nStay safe · scamshield.ai`,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO: full-bleed colored gradient + verdict ── */}
        <LinearGradient colors={BAND_GRADIENT[band]} style={styles.hero}>
          {/* Verdict badge */}
          <View style={[styles.verdictBadge, { borderColor: bandColor + '60', backgroundColor: bandColor + '18' }]}>
            <Text style={styles.verdictBadgeIcon}>{BAND_ICON[band]}</Text>
            <Text style={[styles.verdictBadgeText, { color: bandColor }]}>
              {BAND_LABEL[band]}
            </Text>
          </View>

          {/* App name */}
          <Text style={styles.appName} numberOfLines={2}>{result.appName}</Text>
          {result.packageId ? (
            <Text style={styles.packageId}>{result.packageId}</Text>
          ) : null}

          {/* Gauge */}
          <View style={styles.gaugeContainer}>
            <RiskGauge score={result.score} band={band} />
          </View>

          {/* Share */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Text style={styles.shareBtnText}>↗ Share Result</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── RBI GATE BANNER ── */}
        <View style={[styles.gateBanner, { backgroundColor: gate.bg, borderColor: gate.border }]}>
          <Text style={styles.gateIcon}>{gate.icon}</Text>
          <View style={styles.gateText}>
            <Text style={[styles.gateBannerText, { color: gate.textColor }]}>
              {result.gateBanner}
            </Text>
            <Text style={styles.gateDetails}>{result.gateDetails}</Text>
          </View>
        </View>

        {/* ── ACTION CARD ── */}
        <View style={[styles.actionCard, { borderLeftColor: bandColor }]}>
          <Text style={[styles.actionTitle, { color: bandColor }]}>
            {BAND_ICON[band]}  What should I do?
          </Text>
          <Text style={styles.actionText}>{result.recommendedAction}</Text>

          {band === 'high-risk' && (
            <View style={styles.emergencyRow}>
              <TouchableOpacity
                style={styles.emergencyBtn}
                onPress={() => Linking.openURL('tel:1930')}
                activeOpacity={0.8}
              >
                <Text style={styles.emergencyBtnText}>📞 Call 1930</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emergencyBtn}
                onPress={() => Linking.openURL('https://cybercrime.gov.in')}
                activeOpacity={0.8}
              >
                <Text style={styles.emergencyBtnText}>🌐 cybercrime.gov.in</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── SIGNALS ── */}
        <View style={styles.signalsSection}>
          <View style={styles.signalsHeader}>
            <Text style={styles.signalsTitle}>Why this score?</Text>
            <View style={[styles.scorePill, { backgroundColor: bandColor + '20', borderColor: bandColor + '50' }]}>
              <Text style={[styles.scorePillText, { color: bandColor }]}>{result.score}/100</Text>
            </View>
          </View>
          <Text style={styles.signalsSubtitle}>
            {result.firedSignals.length} signal{result.firedSignals.length !== 1 ? 's' : ''} detected
          </Text>
          {result.firedSignals.map((signal) => (
            <SignalItem key={signal.id} signal={signal} showPoints />
          ))}
        </View>

        {/* ── ACTIONS ── */}
        <View style={styles.buttons}>
          {band === 'high-risk' && (
            <TouchableOpacity style={styles.emergencyProtocolBtn} onPress={handleEmergency} activeOpacity={0.85}>
              <Text style={styles.emergencyProtocolBtnText}>🚨  I've Already Been Scammed — What Now?</Text>
            </TouchableOpacity>
          )}
          {band === 'high-risk' && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.highRisk }]} onPress={handleTakeDown} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Help Take This App Down →</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleReport} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Report This App</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleVerifyAnother} activeOpacity={0.75}>
            <Text style={styles.ghostBtnText}>Verify Another App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  // Hero
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl + spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    marginBottom: spacing.xs,
  },
  verdictBadgeIcon: { fontSize: 18 },
  verdictBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  packageId: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#FFFFFF12',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  gaugeContainer: {
    marginVertical: spacing.md,
  },
  shareBtn: {
    backgroundColor: '#FFFFFF12',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#FFFFFF20',
    marginTop: spacing.xs,
  },
  shareBtnText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },

  // Gate banner
  gateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
  },
  gateIcon: { fontSize: 20, lineHeight: 26 },
  gateText: { flex: 1, gap: 4 },
  gateBannerText: { fontSize: fontSize.xs, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  gateDetails: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 18 },

  // Action card
  actionCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  actionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actionText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  emergencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  emergencyBtn: {
    backgroundColor: '#EF444418',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  emergencyBtnText: { color: colors.highRisk, fontSize: fontSize.sm, fontWeight: '700' },

  // Signals
  signalsSection: { paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  signalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  signalsTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  scorePill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
  scorePillText: { fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.5 },
  signalsSubtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },

  // Buttons
  buttons: { paddingHorizontal: spacing.md, gap: spacing.sm },
  emergencyProtocolBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: '#7C000015',
    borderWidth: 1.5,
    borderColor: '#EF444460',
  },
  emergencyProtocolBtnText: {
    color: colors.highRisk,
    fontSize: fontSize.md,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: fontSize.lg, fontWeight: '700', letterSpacing: 0.2 },
  secondaryBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  secondaryBtnText: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  ghostBtn: { paddingVertical: spacing.md, alignItems: 'center' },
  ghostBtnText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },
});
