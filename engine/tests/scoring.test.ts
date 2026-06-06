import { score } from '../src/scoring';
import { normalizeName } from '../src/rbi-lookup';
import { AppProfile, RBIDataset } from '../src/types';

const MOCK_DATASET: RBIDataset = {
  fetchedAt: '2025-01-01T00:00:00Z',
  recordCount: 3,
  sourceUrl: 'https://rbi.org.in',
  disclaimer: 'Test data',
  records: [
    {
      dlaName: 'CashKaro',
      registeredEntity: 'Axis Bank',
      packageId: 'com.cashkaro.cashback',
      normalizedDlaName: 'cashkaro',
      normalizedEntityName: 'axis bank',
    },
    {
      dlaName: 'KreditBee',
      registeredEntity: 'IIFL Finance',
      packageId: 'com.kreditbee.app',
      normalizedDlaName: 'kreditbee',
      normalizedEntityName: 'iifl',
    },
  ],
  nbfcList: ['Axis Bank Limited', 'IIFL Finance Limited'],
};

describe('ScamShield Scoring Engine', () => {
  // ------------------------------------------------------------------ //
  // 1. Gate-1 unauthorized override: unauthorized lender >= 85, high-risk
  // ------------------------------------------------------------------ //
  test('unauthorized lender scores >= 85 and band = high-risk', () => {
    const profile: AppProfile = {
      appName: 'QuickLoan - Instant Cash',
      packageId: 'com.quickloan.app',
      isFinanceApp: true,
      permissions: ['android.permission.READ_CONTACTS', 'android.permission.READ_SMS'],
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.gate).toBe('unauthorized');
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.band).toBe('high-risk');
  });

  // ------------------------------------------------------------------ //
  // 2. Gate-1 authorized: reduces score, gets 'authorized' gate
  // ------------------------------------------------------------------ //
  test('authorized app gets reduced score and authorized gate', () => {
    const profile: AppProfile = {
      appName: 'CashKaro',
      packageId: 'com.cashkaro.cashback',
      isFinanceApp: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.gate).toBe('authorized');
    // RBI_AUTHORIZED is -5 points, so score should be low
    expect(result.score).toBeLessThan(30);
    expect(result.band).toBe('safe');
    // Verify the authorized signal was fired
    expect(result.firedSignals.some((s) => s.id === 'rbi_authorized')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // 3. Safe app: scores < 30
  // ------------------------------------------------------------------ //
  test('clean non-finance app scores < 30', () => {
    const profile: AppProfile = {
      appName: 'HDFC Bank Mobile Banking',
      packageId: 'com.hdfc.bank',
      isFinanceApp: false,
      hasPrivacyPolicy: true,
      hasVerifiableWebsite: true,
      publishedDaysAgo: 365,
      developerAccountAgeDays: 1000,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.score).toBeLessThan(30);
    expect(result.band).toBe('safe');
  });

  // ------------------------------------------------------------------ //
  // 4. CERT-In listed: scores >= 55 from that signal alone
  // ------------------------------------------------------------------ //
  test('CERT-In listed app scores >= 55', () => {
    const profile: AppProfile = {
      appName: 'EvilApp',
      packageId: 'com.evil.app',
      isFinanceApp: false,
      isCertInListed: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.firedSignals.some((s) => s.id === 'cert_in_listed')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // 5. Contacts+SMS on loan app: CONTACTS_SMS_LOAN signal is +30 points
  // ------------------------------------------------------------------ //
  test('contacts and SMS on finance app fires contacts_sms_loan signal worth +30 points', () => {
    // Verify the SIGNAL_DEFS weight directly, and confirm it fires.
    // Use an app with some base score so clamping at 0 does not distort the diff.
    const baseProfile: AppProfile = {
      appName: 'KreditBee',
      packageId: 'com.kreditbee.app',
      isFinanceApp: true,
      burstReviews: true,        // +12 — pushes base score above 0 before clamping
      hasPrivacyPolicy: false,   // +8
    };
    const baseResult = score(baseProfile, MOCK_DATASET);
    expect(baseResult.gate).toBe('authorized'); // sanity check — gate is stable

    const profileWithPerms: AppProfile = {
      ...baseProfile,
      permissions: ['READ_CONTACTS', 'READ_SMS'],
    };
    const resultWithPerms = score(profileWithPerms, MOCK_DATASET);

    // The diff should be exactly +30 (the contacts_sms_loan signal)
    const diff = resultWithPerms.score - baseResult.score;
    expect(diff).toBe(30);
    expect(resultWithPerms.firedSignals.some((s) => s.id === 'contacts_sms_loan')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // 6. Camera on top of contacts: +10 more
  // ------------------------------------------------------------------ //
  test('camera permission on top of contacts+SMS adds +10 more', () => {
    // Use an authorized app to keep the gate stable, add burst reviews for base score > 0
    const profileContactsSms: AppProfile = {
      appName: 'KreditBee',
      packageId: 'com.kreditbee.app',
      isFinanceApp: true,
      burstReviews: true,
      permissions: ['READ_CONTACTS', 'READ_SMS'],
    };
    const profileWithCamera: AppProfile = {
      ...profileContactsSms,
      permissions: ['READ_CONTACTS', 'READ_SMS', 'CAMERA'],
    };

    const resultContactsSms = score(profileContactsSms, MOCK_DATASET);
    const resultWithCamera = score(profileWithCamera, MOCK_DATASET);

    const diff = resultWithCamera.score - resultContactsSms.score;
    expect(diff).toBe(10);
    expect(resultWithCamera.firedSignals.some((s) => s.id === 'camera_photo_loan')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // 7. Band thresholds: 0-29 safe, 30-64 caution, 65-100 high-risk
  // ------------------------------------------------------------------ //
  test('band thresholds are applied correctly', () => {
    // Safe: no signals
    const safeProfile: AppProfile = {
      appName: 'SafeApp',
      isFinanceApp: false,
      hasPrivacyPolicy: true,
      hasVerifiableWebsite: true,
    };
    const safeResult = score(safeProfile, MOCK_DATASET);
    expect(safeResult.band).toBe('safe');
    expect(safeResult.score).toBeGreaterThanOrEqual(0);
    expect(safeResult.score).toBeLessThan(30);

    // Caution: some signals but not high-risk
    const cautionProfile: AppProfile = {
      appName: 'CautionApp',
      isFinanceApp: false,
      burstReviews: true,         // +12
      hasPrivacyPolicy: false,    // +8
      hasVerifiableWebsite: false, // +5
      developerAccountAgeDays: 45, // +6 (young)
    };
    const cautionResult = score(cautionProfile, MOCK_DATASET);
    // 12 + 8 + 5 + 6 = 31 → caution
    expect(cautionResult.band).toBe('caution');
    expect(cautionResult.score).toBeGreaterThanOrEqual(30);
    expect(cautionResult.score).toBeLessThan(65);

    // High-risk: CERT-In listing alone is 55 points — should be high-risk
    const highRiskProfile: AppProfile = {
      appName: 'HighRiskApp',
      isFinanceApp: false,
      isCertInListed: true,      // +55
      burstReviews: true,        // +12
      hasPrivacyPolicy: false,   // +8
    };
    const highRiskResult = score(highRiskProfile, MOCK_DATASET);
    expect(highRiskResult.band).toBe('high-risk');
    expect(highRiskResult.score).toBeGreaterThanOrEqual(65);
  });

  // ------------------------------------------------------------------ //
  // 8. normalizeName removes noise words
  // ------------------------------------------------------------------ //
  test('normalizeName strips noise words correctly', () => {
    expect(normalizeName('KreditBee Technologies Private Limited')).toBe('kreditbee');
    expect(normalizeName('Axis Bank Limited')).toBe('axis bank');
    expect(normalizeName('IIFL Finance Services Pvt Ltd')).toBe('iifl');
    expect(normalizeName('MoneyView Digital Solutions')).toBe('moneyview');
    expect(normalizeName('CashKaro')).toBe('cashkaro');
    expect(normalizeName('India Payments Group Holdings')).toBe('');
  });

  // ------------------------------------------------------------------ //
  // 9. Community reports MANY >= 25: +20 points
  // ------------------------------------------------------------------ //
  test('community reports >= 25 adds +20 points', () => {
    const baseProfile: AppProfile = {
      appName: 'ReportedApp',
      isFinanceApp: false,
    };
    const baseResult = score(baseProfile, MOCK_DATASET);

    const reportedProfile: AppProfile = {
      ...baseProfile,
      communityReports: 25,
    };
    const reportedResult = score(reportedProfile, MOCK_DATASET);

    const diff = reportedResult.score - baseResult.score;
    expect(diff).toBe(20);
    expect(reportedResult.firedSignals.some((s) => s.id === 'community_reports_many')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // Extra: Score is clamped between 0 and 100
  // ------------------------------------------------------------------ //
  test('score is always clamped between 0 and 100', () => {
    const extremeProfile: AppProfile = {
      appName: 'ExtremeScamApp',
      packageId: 'com.extreme.scam',
      isFinanceApp: true,
      permissions: ['READ_CONTACTS', 'READ_SMS', 'CAMERA'],
      isCertInListed: true,
      communityReports: 50,
      harassmentReviewCount: 15,
      burstReviews: true,
      hasPrivacyPolicy: false,
      hasVerifiableWebsite: false,
      developerAccountAgeDays: 5,
      publishedDaysAgo: 5,
      supportPhoneCountry: 'PK',
    };
    const result = score(extremeProfile, MOCK_DATASET);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  // ------------------------------------------------------------------ //
  // Extra: RBI gate does not apply to non-finance apps
  // ------------------------------------------------------------------ //
  test('non-finance app gets gate=na', () => {
    const profile: AppProfile = {
      appName: 'A Random Game App',
      isFinanceApp: false,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.gate).toBe('na');
  });

  // ------------------------------------------------------------------ //
  // Extra: Harassment reviews — many vs some thresholds
  // ------------------------------------------------------------------ //
  test('harassment reviews many (>=10) fires many signal', () => {
    const profile: AppProfile = {
      appName: 'HarassmentApp',
      isFinanceApp: false,
      harassmentReviewCount: 10,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'harassment_reviews_many')).toBe(true);
    expect(result.firedSignals.some((s) => s.id === 'harassment_reviews_some')).toBe(false);
  });

  test('harassment reviews some (3-9) fires some signal', () => {
    const profile: AppProfile = {
      appName: 'HarassmentApp',
      isFinanceApp: false,
      harassmentReviewCount: 5,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'harassment_reviews_some')).toBe(true);
    expect(result.firedSignals.some((s) => s.id === 'harassment_reviews_many')).toBe(false);
  });

  // ------------------------------------------------------------------ //
  // Extra: Package ID match overrides fuzzy logic for RBI lookup
  // ------------------------------------------------------------------ //
  test('exact packageId match returns authorized gate', () => {
    const profile: AppProfile = {
      appName: 'Some Other Name',
      packageId: 'com.kreditbee.app',
      isFinanceApp: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.gate).toBe('authorized');
  });

  // ------------------------------------------------------------------ //
  // 10. Fuzzy match MUST NOT return authorized (catastrophic regression fix)
  // ------------------------------------------------------------------ //
  test('fuzzy name match does not grant authorized gate', () => {
    // "CashKaro Clone" fuzzy-matches "CashKaro" — must NOT become authorized
    const profile: AppProfile = {
      appName: 'CashKaro Clone',
      packageId: 'com.scam.cashkaro.clone',
      isFinanceApp: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.gate).not.toBe('authorized');
    // Should land on unverified or unauthorized (no matching packageId, not an exact name match)
    expect(['unverified', 'unauthorized']).toContain(result.gate);
  });

  // ------------------------------------------------------------------ //
  // 11. BIND_ACCESSIBILITY_SERVICE fires accessibility_service signal (+40)
  // ------------------------------------------------------------------ //
  test('BIND_ACCESSIBILITY_SERVICE fires accessibility_service signal', () => {
    const baseProfile: AppProfile = {
      appName: 'SuspiciousApp',
      isFinanceApp: false,
      hasPrivacyPolicy: true,
    };
    const profileWithAccessibility: AppProfile = {
      ...baseProfile,
      permissions: ['android.permission.BIND_ACCESSIBILITY_SERVICE'],
    };

    const baseResult = score(baseProfile, MOCK_DATASET);
    const resultWithA11y = score(profileWithAccessibility, MOCK_DATASET);

    expect(resultWithA11y.firedSignals.some((s) => s.id === 'accessibility_service')).toBe(true);
    const diff = resultWithA11y.score - baseResult.score;
    expect(diff).toBe(40);
  });

  // ------------------------------------------------------------------ //
  // 12. BIND_DEVICE_ADMIN fires device_admin signal (+25)
  // ------------------------------------------------------------------ //
  test('BIND_DEVICE_ADMIN fires device_admin signal', () => {
    const baseProfile: AppProfile = {
      appName: 'SuspiciousApp',
      isFinanceApp: false,
      hasPrivacyPolicy: true,
    };
    const profileWithAdmin: AppProfile = {
      ...baseProfile,
      permissions: ['android.permission.BIND_DEVICE_ADMIN'],
    };

    const baseResult = score(baseProfile, MOCK_DATASET);
    const resultWithAdmin = score(profileWithAdmin, MOCK_DATASET);

    expect(resultWithAdmin.firedSignals.some((s) => s.id === 'device_admin')).toBe(true);
    const diff = resultWithAdmin.score - baseResult.score;
    expect(diff).toBe(25);
  });

  // ------------------------------------------------------------------ //
  // 13. READ_CALL_LOG fires contacts_sms_loan on finance app
  // ------------------------------------------------------------------ //
  test('READ_CALL_LOG is treated as a lending permission and fires contacts_sms_loan', () => {
    const profile: AppProfile = {
      appName: 'QuickLoan',
      packageId: 'com.quickloan.app',
      isFinanceApp: true,
      permissions: ['android.permission.READ_CALL_LOG'],
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'contacts_sms_loan')).toBe(true);
  });

  // ------------------------------------------------------------------ //
  // 14. Scam package ID pattern fires package_id_scam_pattern signal
  // ------------------------------------------------------------------ //
  test('package ID matching scam pattern fires package_id_scam_pattern', () => {
    const profile: AppProfile = {
      appName: 'Quick Cash Loan',
      packageId: 'com.quick.money.instant',
      isFinanceApp: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'package_id_scam_pattern')).toBe(true);
  });

  test('clean package ID does not fire package_id_scam_pattern', () => {
    const profile: AppProfile = {
      appName: 'KreditBee',
      packageId: 'com.kreditbee.app',
      isFinanceApp: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'package_id_scam_pattern')).toBe(false);
  });

  // ------------------------------------------------------------------ //
  // 15. Sideloaded APK not in store fires sideloaded_not_in_store (+30)
  // ------------------------------------------------------------------ //
  test('sideloaded APK not found in store fires sideloaded_not_in_store', () => {
    const profile: AppProfile = {
      appName: 'Unknown APK',
      packageId: 'com.unknown.apk',
      isSideloaded: true,
      notFoundInPlayStore: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'sideloaded_not_in_store')).toBe(true);
    const signal = result.firedSignals.find((s) => s.id === 'sideloaded_not_in_store')!;
    expect(signal.points).toBe(30);
  });

  // ------------------------------------------------------------------ //
  // 16. Small finance APK (<8MB) fires small_apk_finance signal
  // ------------------------------------------------------------------ //
  test('small finance APK fires small_apk_finance signal', () => {
    const profile: AppProfile = {
      appName: 'TinyLoan',
      packageId: 'com.tiny.loan',
      isFinanceApp: true,
      apkSizeBytes: 3_000_000, // 3 MB
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'small_apk_finance')).toBe(true);
  });

  test('8MB+ finance APK does not fire small_apk_finance', () => {
    const profile: AppProfile = {
      appName: 'LegitLoanApp',
      packageId: 'com.kreditbee.app',
      isFinanceApp: true,
      apkSizeBytes: 25_000_000, // 25 MB
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'small_apk_finance')).toBe(false);
  });

  // ------------------------------------------------------------------ //
  // 17. Known malware hash listed: fires malware_hash_listed (+100), forces high-risk
  // ------------------------------------------------------------------ //
  test('malware hash listed fires malware_hash_listed and forces score >= 100 (clamped)', () => {
    const profile: AppProfile = {
      appName: 'MalwareApp',
      packageId: 'com.malware.app',
      isFinanceApp: false,
      malwareHashListed: true,
    };
    const result = score(profile, MOCK_DATASET);
    expect(result.firedSignals.some((s) => s.id === 'malware_hash_listed')).toBe(true);
    expect(result.score).toBe(100);
    expect(result.band).toBe('high-risk');
  });
});
