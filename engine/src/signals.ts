import { Signal } from './types';

type SignalTemplate = Omit<Signal, 'fired'>;

export const SIGNAL_DEFS: Record<string, SignalTemplate> = {
  CONTACTS_SMS_LOAN: {
    id: 'contacts_sms_loan',
    name: 'Contacts/SMS access on loan app',
    description:
      "Legitimate lenders don't need your contact list. RBI digital-lending norms explicitly restrict this. It's the primary harassment and blackmail tool.",
    icon: '📋',
    points: 30,
    severity: 'critical',
  },
  CAMERA_PHOTO_LOAN: {
    id: 'camera_photo_loan',
    name: 'Camera/Photos access on loan app',
    description:
      'Camera and photo access on a lending app is a precursor to image-based blackmail (sextortion).',
    icon: '📷',
    points: 10,
    severity: 'high',
  },
  CONTACTS_SMS_NONFINANCE: {
    id: 'contacts_sms_nonfinance',
    name: 'Contacts/SMS access — purpose mismatch',
    description:
      'This non-finance app requests contacts or SMS access, which is inconsistent with its stated purpose.',
    icon: '⚠️',
    points: 15,
    severity: 'high',
  },
  BURST_REVIEWS: {
    id: 'burst_reviews',
    name: 'Suspicious review pattern',
    description:
      'A burst of near-identical 5-star reviews was detected — strongly suggests paid or coordinated fake reviews.',
    icon: '⭐',
    points: 12,
    severity: 'medium',
  },
  HARASSMENT_REVIEWS_MANY: {
    id: 'harassment_reviews_many',
    name: 'Many harassment reports in reviews',
    description:
      'Many genuine reviews contain keywords like "blackmail", "morphed photos", "harassment", "+92 calls". Victims are warning you.',
    icon: '🚨',
    points: 18,
    severity: 'critical',
  },
  HARASSMENT_REVIEWS_SOME: {
    id: 'harassment_reviews_some',
    name: 'Some harassment mentions in reviews',
    description:
      'Some genuine reviews mention harassment or blackmail. Treat as a warning sign.',
    icon: '⚠️',
    points: 8,
    severity: 'high',
  },
  NEW_DEVELOPER_ACCOUNT: {
    id: 'new_developer_account',
    name: 'Brand-new developer account',
    description:
      'This developer account was created less than 30 days ago. Scam apps frequently re-upload from new accounts after takedown.',
    icon: '👤',
    points: 12,
    severity: 'medium',
  },
  YOUNG_DEVELOPER_ACCOUNT: {
    id: 'young_developer_account',
    name: 'Young developer account',
    description: 'Developer account is less than 1 year old.',
    icon: '👤',
    points: 6,
    severity: 'low',
  },
  NO_PRIVACY_POLICY: {
    id: 'no_privacy_policy',
    name: 'No privacy policy',
    description:
      'This app has no privacy policy. Any app collecting personal data is legally required to have one.',
    icon: '📄',
    points: 8,
    severity: 'medium',
  },
  NO_VERIFIABLE_WEBSITE: {
    id: 'no_verifiable_website',
    name: 'No verifiable website',
    description:
      'The developer has no verifiable web presence. Legitimate companies have traceable addresses.',
    icon: '🌐',
    points: 5,
    severity: 'low',
  },
  SUPPORT_NUMBER_MISMATCH: {
    id: 'support_number_mismatch',
    name: 'Foreign support number for India-facing app',
    description:
      'An India-facing app with a foreign support number (e.g., Pakistani +92) is a classic scam red flag.',
    icon: '📞',
    points: 6,
    severity: 'medium',
  },
  VERY_NEW_APP: {
    id: 'very_new_app',
    name: 'App published very recently',
    description:
      'Published less than 14 days ago. Scam apps often get taken down and re-uploaded under a new name.',
    icon: '🆕',
    points: 8,
    severity: 'medium',
  },
  FAIRLY_NEW_APP: {
    id: 'fairly_new_app',
    name: 'App published recently',
    description:
      "Published less than 60 days ago. Lower confidence in the app's track record.",
    icon: '🆕',
    points: 4,
    severity: 'low',
  },
  COMMUNITY_REPORTS_MANY: {
    id: 'community_reports_many',
    name: 'Many ScamShield reports',
    description:
      '25 or more ScamShield users have reported this app as harmful.',
    icon: '🚩',
    points: 20,
    severity: 'critical',
  },
  COMMUNITY_REPORTS_SOME: {
    id: 'community_reports_some',
    name: 'Several ScamShield reports',
    description: '5 or more ScamShield users have flagged this app.',
    icon: '🚩',
    points: 10,
    severity: 'high',
  },
  COMMUNITY_REPORTS_FEW: {
    id: 'community_reports_few',
    name: 'ScamShield reports',
    description: 'At least 1 ScamShield user has reported this app.',
    icon: '🚩',
    points: 4,
    severity: 'low',
  },
  CERT_IN_LISTED: {
    id: 'cert_in_listed',
    name: 'Listed in CERT-In/Cybercrime advisory',
    description:
      'This app has been named in an official government cybercrime advisory. Highest possible risk signal.',
    icon: '🔴',
    points: 55,
    severity: 'critical',
  },
  RBI_AUTHORIZED: {
    id: 'rbi_authorized',
    name: 'Registered in RBI DLA directory',
    description:
      "Found in RBI's Digital Lending App directory — linked to a regulated financial entity. Note: this confirms claimed authorisation, not conduct.",
    icon: '✅',
    points: -5,
    severity: 'low',
  },
  RBI_UNVERIFIED: {
    id: 'rbi_unverified',
    name: 'Not found in RBI DLA directory',
    description:
      "This appears to be a lending app but is not listed in the RBI's Digital Lending App directory. Do not share IDs or contact list.",
    icon: '⚠️',
    points: 14,
    severity: 'high',
  },
  RBI_UNAUTHORIZED: {
    id: 'rbi_unauthorized',
    name: 'Fails RBI registration check',
    description:
      'This lending app has no link to any RBI-regulated entity. Operating an unauthorized digital lending app violates RBI norms.',
    icon: '🚫',
    points: 55,
    severity: 'critical',
  },
  SIDELOADED_NOT_IN_STORE: {
    id: 'sideloaded_not_in_store',
    name: 'APK sideloaded — not found in any app store',
    description:
      'This APK was downloaded outside the Play Store and could not be matched to any official store listing. Unverified APKs bypassing store review are a primary malware and spyware distribution vector.',
    icon: '📦',
    points: 30,
    severity: 'critical',
  },
  ACCESSIBILITY_SERVICE: {
    id: 'accessibility_service',
    name: 'Requests Accessibility Service permission',
    description:
      'BIND_ACCESSIBILITY_SERVICE grants full control over your screen and all running apps — it can read every screen, intercept OTPs, banking passwords, and UPI PINs across ALL apps, and can prevent uninstallation. No legitimate lending app needs this. This is the single most dangerous Android permission.',
    icon: '🔴',
    points: 40,
    severity: 'critical',
  },
  DEVICE_ADMIN: {
    id: 'device_admin',
    name: 'Requests Device Administrator rights',
    description:
      'Device Admin rights allow an app to lock your phone, wipe it remotely, and prevent its own uninstallation. Predatory loan apps use this to trap victims. No legitimate consumer app needs Device Admin access.',
    icon: '🔴',
    points: 25,
    severity: 'critical',
  },
  PACKAGE_ID_SCAM_PATTERN: {
    id: 'package_id_scam_pattern',
    name: 'Package ID matches known scam pattern',
    description:
      'This app\'s package ID matches patterns used by known predatory loan apps (e.g., com.loan.cash.credit.*, com.rupee.fast.*, com.quick.money.*). These naming patterns are used repeatedly by scam operators after takedowns.',
    icon: '🚩',
    points: 15,
    severity: 'high',
  },
  SMALL_APK_FINANCE: {
    id: 'small_apk_finance',
    name: 'Unusually small finance app',
    description:
      'This finance app is under 8 MB — well below the typical size for a legitimate banking or lending app. Minimal-footprint fake finance apps are a common tactic to avoid Play Store review scrutiny.',
    icon: '⚠️',
    points: 10,
    severity: 'medium',
  },
  INSTALL_PACKAGES_SIDELOADED: {
    id: 'install_packages_sideloaded',
    name: 'Can install other APKs — sideloaded',
    description:
      'This sideloaded APK requests permission to install additional packages silently. This is the primary technique used by dropper malware to install spyware, adware, or ransomware in the background after initial install.',
    icon: '📦',
    points: 25,
    severity: 'critical',
  },
  MALWARE_HASH_LISTED: {
    id: 'malware_hash_listed',
    name: 'APK hash found in malware database',
    description:
      'This APK\'s SHA-256 hash is listed in MalwareBazaar — a curated database of confirmed malware samples maintained by abuse.ch. This APK is a KNOWN malicious file. Do NOT install or open it.',
    icon: '☠️',
    points: 100,
    severity: 'critical',
  },
  SIDELOADED_IMPERSONATES_KNOWN_APP: {
    id: 'sideloaded_impersonates_known_app',
    name: 'Sideloaded APK claims identity of a Play Store app',
    description:
      'This APK was downloaded outside the Play Store but claims the same package ID as a legitimate app on the Play Store. A tampered or trojanised copy of a known app is a common malware distribution technique. The APK may have been modified to add spyware, credential stealers, or ransomware while keeping the original app\'s branding intact.',
    icon: '🎭',
    points: 45,
    severity: 'critical',
  },
};

export function makeSignal(key: keyof typeof SIGNAL_DEFS, fired: boolean): Signal {
  return { ...SIGNAL_DEFS[key], fired };
}
