import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, VerifyRequest } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';
import { useRecentVerifications } from '../hooks/useRecentVerifications';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

interface DemoCard {
  emoji: string;
  label: string;
  sublabel: string;
  scenario: 'safe' | 'caution' | 'high-risk';
  appName: string;
  packageId: string;
  borderColor: string;
  gradientColors: readonly [string, string, string];
  badgeColor: string;
  badgeBg: string;
}

const DEMO_CARDS: DemoCard[] = [
  {
    emoji: '🚨',
    label: 'QuickRupee',
    sublabel: 'Instant Loan',
    scenario: 'high-risk',
    appName: 'QuickRupee - Instant Loan',
    packageId: 'com.quickrupee.instant',
    borderColor: '#EF444440',
    gradientColors: ['#450a0a', '#2d0505', '#1a0303'],
    badgeColor: '#EF4444',
    badgeBg: '#EF444420',
  },
  {
    emoji: '✅',
    label: 'HDFC Bank',
    sublabel: 'Mobile Banking',
    scenario: 'safe',
    appName: 'HDFC Bank MobileBanking',
    packageId: 'com.hdfcbank.mobilebanking',
    borderColor: '#22C55E40',
    gradientColors: ['#052e16', '#0a3d1c', '#0d1f11'],
    badgeColor: '#22C55E',
    badgeBg: '#22C55E20',
  },
  {
    emoji: '⚠️',
    label: 'CashCow',
    sublabel: 'Loans',
    scenario: 'caution',
    appName: 'CashCow Loans',
    packageId: 'com.cashcow.loans',
    borderColor: '#F59E0B40',
    gradientColors: ['#451a03', '#2d1200', '#1a0c00'],
    badgeColor: '#F59E0B',
    badgeBg: '#F59E0B20',
  },
];

const HOW_IT_WORKS = [
  {
    icon: '🏦',
    title: 'RBI Registration Check',
    desc: "Cross-references the developer against RBI authorised NBFC and payment aggregator lists.",
  },
  {
    icon: '🔑',
    title: 'Permission Risk Analysis',
    desc: 'Flags dangerous permission combinations known to be used for harassment and data theft.',
  },
  {
    icon: '👥',
    title: 'Community Reports',
    desc: 'Aggregates ScamShield user reports, cybercrime portal complaints, and block-list data.',
  },
];

const STATS_PILLS = ['3-layer verification', 'RBI Registered', 'Community Reports'];

const BAND_COLOR: Record<string, string> = {
  safe: colors.safe,
  caution: colors.caution,
  'high-risk': colors.highRisk,
};

export default function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const recentVerifications = useRecentVerifications();

  const handleVerify = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let packageId: string | undefined;
    let url: string | undefined;
    let appName = trimmed;

    const pkgMatch = trimmed.match(/id=([a-zA-Z0-9._]+)/);
    if (pkgMatch) {
      packageId = pkgMatch[1];
      url = trimmed;
      appName = packageId;
    }

    const request: VerifyRequest = {
      url,
      packageId,
      appName,
      isFinanceApp: true,
    };

    navigation.navigate('Scanning', { appName, packageId, url, request });
  };

  const handleDemo = (card: DemoCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const request: VerifyRequest = {
      appName: card.appName,
      packageId: card.packageId,
      isFinanceApp: true,
    };
    navigation.navigate('Scanning', {
      appName: card.appName,
      packageId: card.packageId,
      request,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero section */}
          <LinearGradient
            colors={['#0D1117', '#161B22', '#0D1117']}
            style={styles.hero}
          >
            {/* Shield with glow ring */}
            <View style={styles.shieldWrapper}>
              <View style={styles.shieldGlow} />
              <View style={styles.shieldCircle}>
                <Text style={styles.shieldEmoji}>🛡️</Text>
              </View>
            </View>

            <Text style={styles.logoText}>ScamShield</Text>
            <Text style={styles.tagline}>Verify any app before you trust it</Text>

            {/* Stats bar */}
            <View style={styles.statsPills}>
              {STATS_PILLS.map((pill, i) => (
                <View key={i} style={styles.statsPill}>
                  <Text style={styles.statsPillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Search card */}
          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>Check an app</Text>
            <TextInput
              style={[
                styles.input,
                inputFocused && styles.inputFocused,
              ]}
              placeholder="Paste Play Store link or app name..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleVerify}
              selectionColor={colors.primary}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <TouchableOpacity
              onPress={handleVerify}
              activeOpacity={0.85}
              disabled={!query.trim()}
            >
              <LinearGradient
                colors={query.trim() ? ['#4338ca', '#6366f1'] : ['#2A3150', '#2A3150']}
                style={[styles.verifyBtn, !query.trim() && styles.verifyBtnDisabled]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.verifyBtnText}>Verify App</Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.inputHint}>
              Works with Play Store URLs, package IDs (com.example.app), or app names.
            </Text>
          </View>

          {/* Recent verifications */}
          {recentVerifications && recentVerifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScroll}
              >
                {recentVerifications.map((v, i) => (
                  <View
                    key={i}
                    style={[
                      styles.recentChip,
                      { borderColor: BAND_COLOR[v.band] + '50' },
                    ]}
                  >
                    <View
                      style={[
                        styles.recentDot,
                        { backgroundColor: BAND_COLOR[v.band] },
                      ]}
                    />
                    <Text style={styles.recentChipText} numberOfLines={1}>
                      {v.appName}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Demo section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Try a demo</Text>
            <Text style={styles.sectionSubtitle}>See how ScamShield analyses real scenarios</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.demoScroll}
            >
              {DEMO_CARDS.map((card) => (
                <AnimatedDemoCard
                  key={card.scenario}
                  card={card}
                  onPress={() => handleDemo(card)}
                />
              ))}
            </ScrollView>
          </View>

          {/* How it works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How it works</Text>
            {HOW_IT_WORKS.map((item, i) => (
              <View key={i} style={styles.howRow}>
                <LinearGradient
                  colors={['#1E2436', '#141826']}
                  style={styles.howIconBox}
                >
                  <Text style={styles.howIcon}>{item.icon}</Text>
                </LinearGradient>
                <View style={styles.howText}>
                  <Text style={styles.howTitle}>{item.title}</Text>
                  <Text style={styles.howDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => Linking.openURL('https://scamshield.ai/privacy')}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerText}>v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AnimatedDemoCard({
  card,
  onPress,
}: {
  card: DemoCard;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1.0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const BAND_LABELS: Record<string, string> = {
    'high-risk': 'HIGH RISK',
    safe: 'SAFE',
    caution: 'CAUTION',
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <LinearGradient
          colors={card.gradientColors}
          style={[styles.demoCard, { borderColor: card.borderColor }]}
        >
          <Text style={styles.demoEmoji}>{card.emoji}</Text>
          <Text style={styles.demoLabel}>{card.label}</Text>
          <Text style={styles.demoSublabel}>{card.sublabel}</Text>
          <View style={[styles.demoBadge, { backgroundColor: card.badgeBg, borderColor: card.badgeColor + '60' }]}>
            <Text style={[styles.demoBadgeText, { color: card.badgeColor }]}>
              {BAND_LABELS[card.scenario]}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  // Hero
  hero: {
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  shieldWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  shieldGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366F1',
    opacity: 0.15,
  },
  shieldCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6366F118',
    borderWidth: 1.5,
    borderColor: '#6366F140',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldEmoji: {
    fontSize: 44,
  },
  logoText: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statsPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  statsPill: {
    backgroundColor: '#6366F115',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 1,
    borderWidth: 1,
    borderColor: '#6366F130',
  },
  statsPillText: {
    fontSize: fontSize.xs,
    color: colors.primaryLight,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Search card
  searchCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#6366F130',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  searchLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: '#2A3150',
    marginBottom: spacing.sm,
  },
  inputFocused: {
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  verifyBtnDisabled: {
    opacity: 0.45,
  },
  verifyBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Section
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Recent verifications
  recentScroll: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
  },
  recentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recentChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    maxWidth: 120,
  },
  // Demo cards
  demoScroll: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  demoCard: {
    width: 148,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  demoEmoji: {
    fontSize: 30,
    marginBottom: spacing.xs,
  },
  demoLabel: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  demoSublabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },
  demoBadge: {
    marginTop: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  // How it works
  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  howIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  howIcon: {
    fontSize: 22,
  },
  howText: {
    flex: 1,
  },
  howTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  howDesc: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
  footerLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  footerDot: {
    color: colors.textMuted,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
});
