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

  const playStoreReportText = buildPlayStoreReportText(appName, packageId, result);

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
