import { ScoreResult, Signal } from '../../domain/entities/AppVerification';

// ─── Mock signal library ──────────────────────────────────────────────────────

const SIGNAL_RBI_UNAUTHORIZED: Signal = {
  id: 'RBI_UNAUTHORIZED',
  name: 'Not RBI Registered',
  description: 'No record found in the RBI authorised NBFC or payment aggregator lists.',
  icon: '🏦',
  points: 55,
  severity: 'critical',
  fired: true,
};

const SIGNAL_RBI_AUTHORIZED: Signal = {
  id: 'RBI_AUTHORIZED',
  name: 'RBI Registered Entity',
  description: 'This app developer is listed in the RBI authorised institution registry.',
  icon: '✅',
  points: -5,
  severity: 'low',
  fired: true,
};


const SIGNAL_CONTACTS_SMS_LOAN: Signal = {
  id: 'CONTACTS_SMS_LOAN',
  name: 'Contacts + SMS Access (Loan App)',
  description:
    'This finance app requests contacts and SMS permissions — a known harassment vector used to threaten borrowers.',
  icon: '📱',
  points: 30,
  severity: 'critical',
  fired: true,
};

const SIGNAL_CAMERA_PHOTO_LOAN: Signal = {
  id: 'CAMERA_PHOTO_LOAN',
  name: 'Camera/Gallery on Loan App',
  description: 'Loan app requesting camera or photo library access beyond what is required for KYC.',
  icon: '📷',
  points: 10,
  severity: 'high',
  fired: true,
};

const SIGNAL_NEW_DEVELOPER_ACCOUNT: Signal = {
  id: 'NEW_DEVELOPER_ACCOUNT',
  name: 'New Developer Account',
  description:
    'Developer account is less than 90 days old — common pattern for disposable scam publishers.',
  icon: '🆕',
  points: 12,
  severity: 'high',
  fired: true,
};

const SIGNAL_NO_PRIVACY_POLICY: Signal = {
  id: 'NO_PRIVACY_POLICY',
  name: 'No Privacy Policy',
  description: 'App has no verifiable privacy policy — a Google Play policy violation.',
  icon: '🔒',
  points: 8,
  severity: 'medium',
  fired: true,
};

const SIGNAL_BURST_REVIEWS: Signal = {
  id: 'BURST_REVIEWS',
  name: 'Suspicious Review Burst',
  description: 'Unusually high volume of 5-star reviews appeared within 7 days of launch.',
  icon: '⭐',
  points: 12,
  severity: 'medium',
  fired: true,
};

const SIGNAL_YOUNG_DEVELOPER_ACCOUNT: Signal = {
  id: 'YOUNG_DEVELOPER_ACCOUNT',
  name: 'Young Developer Account',
  description: 'Developer account is under 180 days old — elevated risk profile.',
  icon: '📅',
  points: 6,
  severity: 'low',
  fired: true,
};

const SIGNAL_FAIRLY_NEW_APP: Signal = {
  id: 'FAIRLY_NEW_APP',
  name: 'App Published Recently',
  description:
    'App was published within the last 6 months. Legitimate apps, but warrants monitoring.',
  icon: '🕐',
  points: 4,
  severity: 'low',
  fired: true,
};

const SIGNAL_COMMUNITY_REPORTS: Signal = {
  id: 'COMMUNITY_REPORTS',
  name: 'User Scam Reports',
  description:
    'Multiple users have flagged this app as a scam via ScamShield community reports.',
  icon: '🚨',
  points: 20,
  severity: 'high',
  fired: true,
};

const SIGNAL_NO_WEBSITE: Signal = {
  id: 'NO_WEBSITE',
  name: 'No Verifiable Website',
  description:
    'Developer website is missing, broken, or parked — cannot verify business identity.',
  icon: '🌐',
  points: 8,
  severity: 'medium',
  fired: true,
};

// ─── Mock results ──────────────────────────────────────────────────────────────

function getHighRiskMock(appName: string): ScoreResult {
  return {
    appName,
    packageId: 'com.quickrupee.instant',
    score: 92,
    band: 'high-risk',
    verdictLabel: 'High Risk',
    gate: 'unauthorized',
    gateBanner: 'FAILS RBI REGISTRATION GATE',
    gateDetails:
      'This entity does not appear in the RBI list of authorised NBFCs, payment aggregators, or lending partners.',
    firedSignals: [
      SIGNAL_RBI_UNAUTHORIZED,
      SIGNAL_CONTACTS_SMS_LOAN,
      SIGNAL_CAMERA_PHOTO_LOAN,
      SIGNAL_NEW_DEVELOPER_ACCOUNT,
      SIGNAL_NO_PRIVACY_POLICY,
      SIGNAL_COMMUNITY_REPORTS,
      SIGNAL_NO_WEBSITE,
    ],
    recommendedAction:
      'DO NOT proceed. This lending app is not on the RBI-authorised list — no legitimate lender in India operates outside this registry. Do not enter Aadhaar, PAN, bank details, or allow contacts/SMS access. If already installed, uninstall immediately. If you have been scammed, call 1930 or file at cybercrime.gov.in.',
  };
}

function getSafeMock(appName: string): ScoreResult {
  return {
    appName,
    packageId: 'com.hdfcbank.mobilebanking',
    score: 12,
    band: 'safe',
    verdictLabel: 'Likely Safe',
    gate: 'authorized',
    gateBanner: 'PASSES RBI REGISTRATION GATE',
    gateDetails: 'Developer is listed in the RBI authorised scheduled commercial bank registry.',
    firedSignals: [SIGNAL_RBI_AUTHORIZED, SIGNAL_FAIRLY_NEW_APP],
    recommendedAction:
      'This app appears legitimate. Verify you are downloading from the official publisher (check developer name on the Play Store listing). Keep your app updated and use strong 2FA.',
  };
}

function getCautionMock(appName: string): ScoreResult {
  return {
    appName,
    packageId: 'com.cashcow.loans',
    score: 48,
    band: 'caution',
    verdictLabel: 'Exercise Caution',
    gate: 'na',
    gateBanner: 'NOT A REGULATED LENDING APP',
    gateDetails: 'RBI registration gate does not apply to this app category.',
    firedSignals: [
      SIGNAL_BURST_REVIEWS,
      SIGNAL_NO_PRIVACY_POLICY,
      SIGNAL_YOUNG_DEVELOPER_ACCOUNT,
    ],
    recommendedAction:
      "Exercise caution. Independently verify this app before sharing any personal or financial data. Check the developer's credentials and reviews carefully.",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getMockResult(appName: string): ScoreResult {
  const lower = (appName || '').toLowerCase();

  const isHighRisk = /quickloan|quickrupee|fastloan|easyloan/.test(lower);
  const isSafe = /\bhdfc\b|\bsbi\b|\bicici\b|\baxis\b|cashkaro/.test(lower);

  if (isHighRisk) return getHighRiskMock(appName);
  if (isSafe) return getSafeMock(appName);
  return getCautionMock(appName);
}

export function getDemoResult(scenario: 'safe' | 'caution' | 'high-risk'): ScoreResult {
  if (scenario === 'high-risk') return getHighRiskMock('QuickRupee - Instant Loan');
  if (scenario === 'safe') return getSafeMock('HDFC Bank MobileBanking');
  return getCautionMock('CashCow Loans');
}
