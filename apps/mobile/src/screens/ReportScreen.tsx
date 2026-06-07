import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, ScoreResult } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';
import { submitReport } from '../api/reports';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Report'>;
  route: RouteProp<RootStackParamList, 'Report'>;
};

const REPORT_TYPES = ['Scam', 'Harassment', 'Fake', 'Data Theft'];

function buildAppleEmailBody(appName: string, packageId: string | undefined, result?: ScoreResult): string {
  const score = result?.score ?? '?';
  const band = result?.band ?? 'high-risk';
  const gate = result?.gate;
  const bandLabel = band === 'high-risk' ? 'HIGH RISK' : band === 'caution' ? 'EXERCISE CAUTION' : 'LIKELY SAFE';

  const signalLines = result?.firedSignals?.length
    ? result.firedSignals.map((s) => `• ${s.name}\n  ${s.description}`).join('\n')
    : '• Multiple risk signals detected — see ScamShield report';

  const rbiContext = (gate === 'unverified' || gate === 'unauthorized')
    ? `\nREGULATORY CONTEXT (India)\n${'─'.repeat(26)}\nThis app operates as a digital lending platform without authorisation from the Reserve Bank of India (RBI). The RBI circular RBI/2022-23/111 governs digital lending apps operating in India. This app is NOT listed in the RBI Digital Lending App (DLA) directory, meaning it has no link to any regulated financial entity. Unregistered digital lending apps are the primary vector for loan fraud, borrower harassment, and blackmail targeting Indian users.\n`
    : '';

  return `To the App Store Trust & Safety / App Review Team,

I am reporting a high-risk application that has been verified as fraudulent by ScamShield, an anti-scam platform for the Indian market (scamshield.ai).

APP DETAILS
${'─'.repeat(11)}
Name:          ${appName}
Bundle / ID:   ${packageId ?? 'unknown'}
Risk Score:    ${score} / 100
Risk Band:     ${bandLabel}
Verified by:   ScamShield (https://scamshield.ai)

RISK SIGNALS DETECTED
${'─'.repeat(21)}
${signalLines}
${rbiContext}
WHY THIS IS SERIOUS
${'─'.repeat(19)}
Apps of this type operating in the Indian market are associated with:
• Unauthorised harvesting of contacts, SMS messages, and photos
• Borrower harassment — threatening victims with morphed/intimate photos
• Intercepting OTPs and banking credentials via Accessibility Service abuse
• Preventing uninstallation using Device Administrator rights
• Operating outside any regulatory framework

These are not hypothetical risks — Indian law enforcement and CERT-In have documented widespread harm from apps matching this profile.

REQUESTED ACTION
${'─'.repeat(16)}
Please investigate and remove this application. If it is already on the iOS App Store under this name or a variant, escalating removal would directly protect Indian users.

Thank you for your attention to this matter.

— Reported via ScamShield · scamshield.ai`;
}

function buildPlayStoreReportText(appName: string, packageId: string | undefined, result?: ScoreResult): string {
  const lines: string[] = [];
  const band = result?.band;
  const score = result?.score;
  const gate = result?.gate;

  lines.push(`This app has been identified as HIGH RISK (Score: ${score ?? '?'}/100) by ScamShield.`);
  lines.push('');
  lines.push('Signals detected:');

  if (gate === 'unverified' || gate === 'unauthorized') {
    lines.push('• Not found in the RBI Digital Lending App (DLA) directory — operating without regulatory authorisation violates RBI/2022-23/111');
  }
  result?.firedSignals?.forEach((s) => {
    lines.push(`• ${s.name}: ${s.description.slice(0, 120)}`);
  });
  if (!result?.firedSignals?.length) {
    lines.push('• Multiple risk signals detected — see ScamShield report');
  }

  lines.push('');
  lines.push('Please remove this app from the Play Store to protect users from financial fraud, data theft, and potential borrower harassment.');
  lines.push('');
  lines.push(`Package ID: ${packageId ?? 'unknown'}`);
  lines.push('Verified by ScamShield · scamshield.ai');
  return lines.join('\n');
}

export default function ReportScreen({ navigation, route }: Props) {
  const { appName, packageId, result } = route.params;
  const [selectedType, setSelectedType] = useState('Scam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appleSent, setAppleSent] = useState(false);

  const playStoreReportText = buildPlayStoreReportText(appName, packageId, result);
  const appleEmailBody = buildAppleEmailBody(appName, packageId, result);
  const appleEmailSubject = `Predatory App Report: ${appName}${packageId ? ` (${packageId})` : ''} — HIGH RISK`;

  const handleSendAppleEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const mailto = `mailto:reportphishing@apple.com?subject=${encodeURIComponent(appleEmailSubject)}&body=${encodeURIComponent(appleEmailBody)}`;
    Linking.openURL(mailto);
    setAppleSent(true);
  };

  const handleCopyReportText = () => {
    Clipboard.setString(playStoreReportText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenPlayStore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const url = packageId
      ? `https://play.google.com/store/apps/details?id=${packageId}`
      : 'https://play.google.com/store/apps';
    Linking.openURL(url);
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    await submitReport({ appName, packageId, reportType: selectedType, description });
    setSubmitting(false);
    setSubmitted(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✅</Text>
          </View>
          <Text style={styles.successTitle}>Thank You</Text>
          <Text style={styles.successMessage}>
            Your report has been submitted. It will be reviewed within 24 hours.
          </Text>
          <Text style={styles.successNote}>
            Your report helps protect others from this app.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Report This App</Text>
            <Text style={styles.subtitle}>
              Reports are reviewed by our team and escalated to relevant authorities.
            </Text>
          </View>

          {/* App info (non-editable) */}
          <View style={styles.appCard}>
            <Text style={styles.appCardLabel}>Reporting</Text>
            <Text style={styles.appCardName}>{appName}</Text>
            {packageId && (
              <View style={styles.packageBadge}>
                <Text style={styles.packageText}>{packageId}</Text>
              </View>
            )}
          </View>

          {/* Report type selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Report Type</Text>
            <View style={styles.typeSelector}>
              {REPORT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    selectedType === type && styles.typeChipActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedType(type);
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === type && styles.typeChipTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (optional)</Text>
            <TextInput
              style={styles.descInput}
              placeholder="Describe what happened — the more detail, the stronger your report..."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor={colors.primary}
            />
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              🔒 Your report is anonymised before escalation. No personal data is shared without consent.
            </Text>
          </View>

          {/* Google Play Report section */}
          <View style={styles.playStoreSection}>
            <Text style={styles.playStoreSectionTitle}>🚩 Also Report on Google Play</Text>
            <Text style={styles.playStoreSectionSub}>
              Copy the pre-filled report text below, then open the app on Google Play and tap{' '}
              <Text style={{ fontWeight: '700', color: colors.textSecondary }}>"Flag as inappropriate"</Text>.
            </Text>
            <View style={styles.reportTextBox}>
              <Text style={styles.reportTextContent} selectable>{playStoreReportText}</Text>
            </View>
            <View style={styles.playStoreBtns}>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyReportText} activeOpacity={0.8}>
                <Text style={styles.copyBtnText}>{copied ? '✅  Copied!' : '📋  Copy Report Text'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.openPlayStoreBtn} onPress={handleOpenPlayStore} activeOpacity={0.8}>
                <Text style={styles.openPlayStoreBtnText}>Open on Play Store ↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Apple Email section */}
          <View style={styles.appleSection}>
            <View style={styles.appleSectionHeader}>
              <Text style={styles.appleSectionTitle}> Email Apple to Escalate Removal</Text>
              {appleSent && (
                <View style={styles.sentBadge}>
                  <Text style={styles.sentBadgeText}>✅ Sent</Text>
                </View>
              )}
            </View>
            <Text style={styles.appleSectionSub}>
              Tap below to open your email app with a complete, ready-to-send report addressed to{' '}
              <Text style={styles.emailHighlight}>reportphishing@apple.com</Text>.
              {'\n'}Just review and hit Send — everything is pre-filled.
            </Text>

            {/* Email preview */}
            <View style={styles.emailPreviewBox}>
              <View style={styles.emailPreviewHeader}>
                <Text style={styles.emailPreviewLabel}>To</Text>
                <Text style={styles.emailPreviewValue}>reportphishing@apple.com</Text>
              </View>
              <View style={[styles.emailPreviewHeader, { borderBottomWidth: 0 }]}>
                <Text style={styles.emailPreviewLabel}>Subject</Text>
                <Text style={styles.emailPreviewValue} numberOfLines={2}>{appleEmailSubject}</Text>
              </View>
              <View style={styles.emailBodyPreview}>
                <Text style={styles.emailBodyPreviewText} numberOfLines={6}>{appleEmailBody}</Text>
                <View style={styles.emailBodyFade} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.appleBtn, appleSent && styles.appleBtnSent]}
              onPress={handleSendAppleEmail}
              activeOpacity={0.85}
            >
              <Text style={styles.appleBtnText}>
                {appleSent ? '✅  Email Client Opened — Check Your App' : '✉️  Open Email to Apple'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  header: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  appCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  appCardLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  appCardName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  packageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgInput,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  packageText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#6366F115',
  },
  typeChipText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: colors.primaryLight,
  },
  descInput: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1.5,
    borderColor: '#2A3150',
    minHeight: 120,
    lineHeight: 22,
  },
  disclaimer: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: '#6366F110',
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    borderWidth: 1,
    borderColor: '#6366F125',
  },
  disclaimerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  playStoreSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: '#EF444410',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#EF444430',
    gap: spacing.sm,
  },
  playStoreSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: colors.highRisk,
    letterSpacing: 0.2,
  },
  playStoreSectionSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  reportTextBox: {
    backgroundColor: '#0B0F1A',
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    borderWidth: 1,
    borderColor: '#EF444420',
  },
  reportTextContent: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  playStoreBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#EF444420',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  copyBtnText: {
    color: colors.highRisk,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  openPlayStoreBtn: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  openPlayStoreBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  appleSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: '#1a1a2e',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#3d3d6b',
    gap: spacing.sm,
  },
  appleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appleSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#a5b4fc',
    letterSpacing: 0.2,
    flex: 1,
  },
  sentBadge: {
    backgroundColor: '#22C55E20',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#22C55E40',
  },
  sentBadgeText: {
    fontSize: fontSize.xs,
    color: colors.safe,
    fontWeight: '700',
  },
  appleSectionSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  emailHighlight: {
    color: '#a5b4fc',
    fontWeight: '700',
  },
  emailPreviewBox: {
    backgroundColor: '#0d0d1a',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#3d3d6b',
    overflow: 'hidden',
  },
  emailPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e3f',
  },
  emailPreviewLabel: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: '#6366F1',
    width: 52,
    letterSpacing: 0.5,
    paddingTop: 1,
  },
  emailPreviewValue: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emailBodyPreview: {
    padding: spacing.sm + 4,
    position: 'relative',
    maxHeight: 120,
    overflow: 'hidden',
  },
  emailBodyPreviewText: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emailBodyFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'transparent',
  },
  appleBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  appleBtnSent: {
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
  },
  appleBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  submitBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#22C55E18',
    borderWidth: 2,
    borderColor: '#22C55E40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successEmoji: {
    fontSize: 44,
  },
  successTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  successMessage: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.md,
  },
  successNote: {
    fontSize: fontSize.md,
    color: colors.safe,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: spacing.xl + spacing.md,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl + spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
