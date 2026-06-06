import {
  AppProfile,
  RBIDataset,
  ScoreResult,
  Signal,
  RiskBand,
  RBIGate,
} from './types';
import { makeSignal } from './signals';
import { lookupRBIGate } from './rbi-lookup';

const LENDING_PERMISSIONS = [
  'READ_CONTACTS',
  'READ_SMS',
  'RECEIVE_SMS',
  'CONTACTS',
  'SMS',
  'READ_CALL_LOG',
  'PROCESS_OUTGOING_CALLS',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_SMS',
  'android.permission.READ_CALL_LOG',
  'android.permission.PROCESS_OUTGOING_CALLS',
];
const CAMERA_PERMISSIONS = [
  'CAMERA',
  'READ_MEDIA_IMAGES',
  'READ_EXTERNAL_STORAGE',
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
];

// RBI/2022-23/111 explicitly prohibits lending apps from requesting these
const ACCESSIBILITY_PERMISSIONS = [
  'BIND_ACCESSIBILITY_SERVICE',
  'android.permission.BIND_ACCESSIBILITY_SERVICE',
];

const DEVICE_ADMIN_PERMISSIONS = [
  'BIND_DEVICE_ADMIN',
  'android.permission.BIND_DEVICE_ADMIN',
];

// Package ID substrings used repeatedly by predatory loan app operators
const SCAM_PACKAGE_PATTERNS = [
  'loan.cash.credit',
  'rupee.fast',
  'quick.money',
  'cash.advance',
  'instant.loan',
  'easy.cash',
  'fast.rupee',
  'shuiyiwenhua',
  'loan.instant',
  'paisa.fast',
];

function hasPermission(permissions: string[] | undefined, targets: string[]): boolean {
  if (!permissions) return false;
  const upper = permissions.map((p) => p.toUpperCase());
  return targets.some((t) =>
    upper.some((p) => p.includes(t.replace('android.permission.', '').toUpperCase())),
  );
}

function buildGateBanner(gate: RBIGate): { gateBanner: string; gateDetails: string } {
  switch (gate) {
    case 'authorized':
      return {
        gateBanner: 'PASSES RBI REGISTRATION GATE',
        gateDetails:
          "Listed in RBI's Digital Lending App directory — authorisation, not conduct.",
      };
    case 'unverified':
      return {
        gateBanner: 'NOT ON THE RBI LIST — HIGH RISK',
        gateDetails:
          'This lending app is not registered with RBI. Unregistered lending apps are a primary vector for loan fraud, data theft, and borrower harassment — even if recently launched on the Play Store.',
      };
    case 'unauthorized':
      return {
        gateBanner: 'FAILS RBI REGISTRATION GATE',
        gateDetails:
          'No link to any RBI-regulated entity found. This app is operating without regulatory authorisation.',
      };
    case 'na':
      return {
        gateBanner: 'NOT A REGULATED LENDING APP',
        gateDetails: 'RBI registration gate does not apply to this app category.',
      };
  }
}

function getBandLabel(band: RiskBand): string {
  switch (band) {
    case 'safe':
      return 'Likely Safe';
    case 'caution':
      return 'Exercise Caution';
    case 'high-risk':
      return 'High Risk';
  }
}

function getRecommendedAction(band: RiskBand, gate: RBIGate): string {
  if (band === 'high-risk') {
    if (gate === 'unverified' || gate === 'unauthorized') {
      return 'DO NOT proceed. This lending app is not on the RBI-authorised list — no legitimate lender in India operates outside this registry. Do not enter Aadhaar, PAN, bank details, or allow contacts/SMS access. If already installed, uninstall immediately. If you have been scammed, call 1930 or file at cybercrime.gov.in.';
    }
    return 'DO NOT proceed. Do not open, login, or share any information with this app. If already installed, uninstall immediately. If you have been scammed, call the National Cyber Crime Helpline 1930 or file a complaint at cybercrime.gov.in.';
  }
  if (band === 'caution') {
    return "Exercise caution. Independently verify this app before sharing any personal or financial data. Check the developer's credentials and reviews carefully.";
  }
  return 'This app shows no major red flags. Exercise normal caution — never share passwords or OTPs with any app.';
}

export function score(profile: AppProfile, dataset: RBIDataset): ScoreResult {
  const signals: Signal[] = [];
  let rawScore = 0;

  // --- Gate 1: RBI Registration ---
  const gate = lookupRBIGate(profile, dataset);

  if (gate === 'authorized') {
    const s = makeSignal('RBI_AUTHORIZED', true);
    signals.push(s);
    rawScore += s.points; // negative
  } else if (gate === 'unverified' && profile.isFinanceApp) {
    const s = makeSignal('RBI_UNVERIFIED', true);
    signals.push(s);
    rawScore += s.points;
  } else if (gate === 'unauthorized') {
    const s = makeSignal('RBI_UNAUTHORIZED', true);
    signals.push(s);
    rawScore += s.points;
  }

  // --- Gate 2: Permissions vs. purpose ---
  const hasContactsSms = hasPermission(profile.permissions, LENDING_PERMISSIONS);
  const hasCamera = hasPermission(profile.permissions, CAMERA_PERMISSIONS);

  if (profile.isFinanceApp && hasContactsSms) {
    const s = makeSignal('CONTACTS_SMS_LOAN', true);
    signals.push(s);
    rawScore += s.points;

    if (hasCamera) {
      const cam = makeSignal('CAMERA_PHOTO_LOAN', true);
      signals.push(cam);
      rawScore += cam.points;
    }
  } else if (!profile.isFinanceApp && hasContactsSms) {
    const s = makeSignal('CONTACTS_SMS_NONFINANCE', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Accessibility service — unconditional; no legitimate consumer app needs it
  if (hasPermission(profile.permissions, ACCESSIBILITY_PERMISSIONS)) {
    const s = makeSignal('ACCESSIBILITY_SERVICE', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Device admin — unconditional; used by predatory apps to block uninstallation
  if (hasPermission(profile.permissions, DEVICE_ADMIN_PERMISSIONS)) {
    const s = makeSignal('DEVICE_ADMIN', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Package ID scam pattern match
  if (profile.packageId) {
    const pkgLower = profile.packageId.toLowerCase();
    if (SCAM_PACKAGE_PATTERNS.some((pattern) => pkgLower.includes(pattern))) {
      const s = makeSignal('PACKAGE_ID_SCAM_PATTERN', true);
      signals.push(s);
      rawScore += s.points;
    }
  }

  // --- Soft signals ---
  if (profile.burstReviews) {
    const s = makeSignal('BURST_REVIEWS', true);
    signals.push(s);
    rawScore += s.points;
  }

  if (profile.harassmentReviewCount !== undefined) {
    if (profile.harassmentReviewCount >= 10) {
      const s = makeSignal('HARASSMENT_REVIEWS_MANY', true);
      signals.push(s);
      rawScore += s.points;
    } else if (profile.harassmentReviewCount >= 3) {
      const s = makeSignal('HARASSMENT_REVIEWS_SOME', true);
      signals.push(s);
      rawScore += s.points;
    }
  }

  if (profile.developerAccountAgeDays !== undefined) {
    if (profile.developerAccountAgeDays < 30) {
      const s = makeSignal('NEW_DEVELOPER_ACCOUNT', true);
      signals.push(s);
      rawScore += s.points;
    } else if (profile.developerAccountAgeDays < 365) {
      const s = makeSignal('YOUNG_DEVELOPER_ACCOUNT', true);
      signals.push(s);
      rawScore += s.points;
    }
  }

  if (profile.hasPrivacyPolicy === false) {
    const s = makeSignal('NO_PRIVACY_POLICY', true);
    signals.push(s);
    rawScore += s.points;
  }

  if (profile.hasVerifiableWebsite === false) {
    const s = makeSignal('NO_VERIFIABLE_WEBSITE', true);
    signals.push(s);
    rawScore += s.points;
  }

  if (profile.supportPhoneCountry && profile.supportPhoneCountry !== 'IN') {
    const s = makeSignal('SUPPORT_NUMBER_MISMATCH', true);
    signals.push(s);
    rawScore += s.points;
  }

  if (profile.publishedDaysAgo !== undefined) {
    if (profile.publishedDaysAgo < 14) {
      const s = makeSignal('VERY_NEW_APP', true);
      signals.push(s);
      rawScore += s.points;
    } else if (profile.publishedDaysAgo < 60) {
      const s = makeSignal('FAIRLY_NEW_APP', true);
      signals.push(s);
      rawScore += s.points;
    }
  }

  if (profile.communityReports !== undefined) {
    if (profile.communityReports >= 25) {
      const s = makeSignal('COMMUNITY_REPORTS_MANY', true);
      signals.push(s);
      rawScore += s.points;
    } else if (profile.communityReports >= 5) {
      const s = makeSignal('COMMUNITY_REPORTS_SOME', true);
      signals.push(s);
      rawScore += s.points;
    } else if (profile.communityReports >= 1) {
      const s = makeSignal('COMMUNITY_REPORTS_FEW', true);
      signals.push(s);
      rawScore += s.points;
    }
  }

  if (profile.isCertInListed) {
    const s = makeSignal('CERT_IN_LISTED', true);
    signals.push(s);
    rawScore += s.points;
  }

  if (profile.isSideloaded && profile.notFoundInPlayStore) {
    const s = makeSignal('SIDELOADED_NOT_IN_STORE', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Sideloaded APK claiming a known Play Store package ID — impersonation vector
  if (profile.isSideloaded && profile.packageId && !profile.notFoundInPlayStore) {
    const s = makeSignal('SIDELOADED_IMPERSONATES_KNOWN_APP', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Small APK for a finance app — legitimate banking/lending apps are rarely under 8 MB
  if (profile.isFinanceApp && profile.apkSizeBytes !== undefined && profile.apkSizeBytes < 8_000_000) {
    const s = makeSignal('SMALL_APK_FINANCE', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Known malware hash — instant critical, overrides all else
  if (profile.malwareHashListed) {
    const s = makeSignal('MALWARE_HASH_LISTED', true);
    signals.push(s);
    rawScore += s.points;
  }

  // Clamp 0–100
  let finalScore = Math.max(0, Math.min(100, rawScore));

  // Any unregistered finance app is immediately high-risk — no second thoughts
  if (gate === 'unauthorized' || gate === 'unverified') {
    finalScore = Math.max(85, finalScore);
  }

  // Determine band
  let band: RiskBand;
  if (finalScore < 30) band = 'safe';
  else if (finalScore < 65) band = 'caution';
  else band = 'high-risk';

  const { gateBanner, gateDetails } = buildGateBanner(gate);
  const firedSignals = signals.filter((s) => s.fired);

  return {
    appName: profile.appName,
    packageId: profile.packageId,
    score: finalScore,
    band,
    verdictLabel: getBandLabel(band),
    gate,
    gateBanner,
    gateDetails,
    firedSignals,
    recommendedAction: getRecommendedAction(band, gate),
  };
}
