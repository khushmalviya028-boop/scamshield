import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Emergency'>;
};

interface Step {
  number: number;
  icon: string;
  title: string;
  detail: string;
  action?: { label: string; url: string };
  critical?: boolean;
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: '📞',
    title: 'Call 1930 RIGHT NOW',
    detail:
      'The National Cyber Crime Financial Helpline. If called within 2 hours of the fraud, they can freeze the receiving account before the money is moved. Every minute counts.',
    action: { label: 'Call 1930', url: 'tel:1930' },
    critical: true,
  },
  {
    number: 2,
    icon: '🔒',
    title: 'Lock Aadhaar Biometrics',
    detail:
      'Open mAadhaar → My Aadhaar → Lock/Unlock Biometrics. This prevents any further eKYC authentication using your fingerprints or iris — blocking fraudsters from opening new accounts in your name.',
    action: { label: 'Open mAadhaar', url: 'https://play.google.com/store/apps/details?id=in.gov.uidai.mAadhaar' },
  },
  {
    number: 3,
    icon: '🚫',
    title: 'Revoke App Permissions',
    detail:
      'Settings → Apps → [App Name] → Permissions → Revoke ALL. Disable Contacts, SMS, Camera, Microphone, Storage, and especially Accessibility if granted. Then uninstall.',
    action: { label: 'Open App Settings', url: 'app-settings:' },
  },
  {
    number: 4,
    icon: '⚠️',
    title: 'Do NOT Pay Any "Fine" or "Fee"',
    detail:
      'Fraudsters will call you demanding payment to "close" the loan, avoid "police action", or "stop" distribution of your photos. These threats are designed to panic you into paying. Paying once leads to escalating demands — it never stops.',
  },
  {
    number: 5,
    icon: '🔃',
    title: 'Uninstall in Safe Mode if Blocked',
    detail:
      'If the app prevents uninstallation: Long-press Power → Long-press Restart → Boot in Safe Mode. In Safe Mode, third-party apps cannot block uninstallation. Go to Settings → Apps and remove it.',
  },
  {
    number: 6,
    icon: '📝',
    title: 'File a Cyber Crime Report',
    detail:
      'File a formal complaint at cybercrime.gov.in → Report Other Cyber Crimes. Include: app name, screenshots, call logs, and any payment details. You will receive a complaint number for tracking.',
    action: { label: 'cybercrime.gov.in', url: 'https://cybercrime.gov.in' },
  },
  {
    number: 7,
    icon: '📱',
    title: 'Report Harassment Numbers',
    detail:
      'Report any mobile numbers used to threaten or harass you to Chakshu on Sanchar Saathi. DoT can block these numbers across all operators.',
    action: { label: 'Sanchar Saathi Chakshu', url: 'https://sancharsaathi.gov.in/sfc/Home/sfc-complaint-new.jsp' },
  },
];

export default function EmergencyScreen({ navigation }: Props) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const toggleStep = (n: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAction = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Protocol</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Urgent banner */}
        <View style={styles.urgentBanner}>
          <Text style={styles.urgentIcon}>🚨</Text>
          <View style={styles.urgentText}>
            <Text style={styles.urgentTitle}>Act Within 2 Hours</Text>
            <Text style={styles.urgentSub}>
              Calling 1930 within 2 hours of a fraud can freeze the fraudster's account before money is moved. Every minute matters.
            </Text>
          </View>
        </View>

        {/* Steps */}
        {STEPS.map((step) => {
          const done = completed.has(step.number);
          return (
            <TouchableOpacity
              key={step.number}
              style={[styles.stepCard, step.critical && styles.stepCardCritical, done && styles.stepCardDone]}
              onPress={() => toggleStep(step.number)}
              activeOpacity={0.85}
            >
              <View style={styles.stepLeft}>
                <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
                  <Text style={styles.stepBadgeText}>{done ? '✓' : step.number}</Text>
                </View>
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepTitleRow}>
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                  <Text style={[styles.stepTitle, step.critical && styles.stepTitleCritical, done && styles.stepTitleDone]}>
                    {step.title}
                  </Text>
                </View>
                <Text style={[styles.stepDetail, done && styles.stepDetailDone]}>{step.detail}</Text>
                {step.action && !done && (
                  <TouchableOpacity
                    style={[styles.actionBtn, step.critical && styles.actionBtnCritical]}
                    onPress={() => handleAction(step.action!.url)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.actionBtnText, step.critical && styles.actionBtnTextCritical]}>
                      {step.action.label} →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Warning: do not pay */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️  If Anyone Calls Demanding Payment</Text>
          <Text style={styles.warningText}>
            Fraudsters impersonate police officers, bank officials, or "RBI agents" to demand you pay a fee to resolve the case.{'\n\n'}
            {'RBI and police NEVER call demanding payment. Hang up immediately and call 1930.'}
          </Text>
        </View>

        {/* Progress */}
        {completed.size > 0 && (
          <View style={styles.progressBox}>
            <Text style={styles.progressText}>
              {completed.size} of {STEPS.length} steps done
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(completed.size / STEPS.length) * 100}%` }]} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 70 },
  backText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },

  urgentBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#EF44441A',
    borderWidth: 1.5,
    borderColor: '#EF444450',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  urgentIcon: { fontSize: 28 },
  urgentText: { flex: 1, gap: 4 },
  urgentTitle: { color: colors.highRisk, fontSize: fontSize.lg, fontWeight: '800' },
  urgentSub: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18 },

  stepCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepCardCritical: {
    borderColor: '#EF444445',
    backgroundColor: '#EF44440D',
  },
  stepCardDone: {
    borderColor: '#22C55E30',
    backgroundColor: '#22C55E08',
    opacity: 0.7,
  },
  stepLeft: { alignItems: 'center', paddingTop: 2 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF15',
    borderWidth: 1.5,
    borderColor: '#FFFFFF30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: '#22C55E30', borderColor: '#22C55E60' },
  stepBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  stepBody: { flex: 1, gap: spacing.xs },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepIcon: { fontSize: 16 },
  stepTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', flex: 1 },
  stepTitleCritical: { color: colors.highRisk },
  stepTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  stepDetail: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18 },
  stepDetailDone: { color: colors.textMuted },
  actionBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '15',
  },
  actionBtnCritical: {
    borderColor: colors.highRisk + '60',
    backgroundColor: colors.highRisk + '18',
  },
  actionBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  actionBtnTextCritical: { color: colors.highRisk },

  warningBox: {
    backgroundColor: '#F59E0B10',
    borderWidth: 1,
    borderColor: '#F59E0B35',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  warningTitle: { color: '#F59E0B', fontSize: fontSize.sm, fontWeight: '800' },
  warningText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 18 },

  progressBox: { marginTop: spacing.md, gap: spacing.xs },
  progressText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  progressBar: {
    height: 4,
    backgroundColor: '#FFFFFF15',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#22C55E',
    borderRadius: 2,
  },
});
