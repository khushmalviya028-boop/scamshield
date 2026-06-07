import { LoanApp, RBIGate, ScoredApp } from './types';

const SMS_CONTACT_PERMS = ['READ_SMS', 'RECEIVE_SMS', 'READ_CONTACTS', 'CONTACTS', 'SMS'];
const ACCESSIBILITY_PERMS = ['BIND_ACCESSIBILITY_SERVICE'];
const DEVICE_ADMIN_PERMS = ['BIND_DEVICE_ADMIN'];
const CAMERA_PERMS = ['CAMERA', 'READ_MEDIA_IMAGES', 'READ_EXTERNAL_STORAGE'];
const OVERLAY_PERMS = ['SYSTEM_ALERT_WINDOW'];
const INSTALL_PERMS = ['REQUEST_INSTALL_PACKAGES', 'INSTALL_PACKAGES'];
const LOCATION_PERMS = ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'];

function hasPerm(permissions: string[], targets: string[]): boolean {
  const upper = permissions.map((p) => p.toUpperCase().replace('ANDROID.PERMISSION.', ''));
  return targets.some((t) => upper.some((p) => p.includes(t)));
}

export function scoreApp(app: LoanApp, gate: RBIGate): ScoredApp {
  const signals: { id: string; label: string; points: number }[] = [];
  let raw = 0;

  const add = (id: string, label: string, points: number) => {
    signals.push({ id, label, points });
    raw += points;
  };

  // RBI gate
  if (gate === 'unauthorized') add('rbi_unauthorized', 'Fails RBI registration check', 55);
  else if (gate === 'unverified') add('rbi_unverified', 'Not found in RBI DLA directory', 14);

  // Permissions
  if (hasPerm(app.permissions, SMS_CONTACT_PERMS)) {
    if (app.isFinanceApp) add('contacts_sms_loan', 'Contacts/SMS access on lending app', 30);
    else add('contacts_sms_nonfinance', 'Contacts/SMS access — purpose mismatch', 15);
  }
  if (hasPerm(app.permissions, ACCESSIBILITY_PERMS))
    add('accessibility', 'Requests Accessibility Service (full screen control)', 40);
  if (hasPerm(app.permissions, DEVICE_ADMIN_PERMS))
    add('device_admin', 'Requests Device Administrator rights (blocks uninstall)', 25);
  if (hasPerm(app.permissions, CAMERA_PERMS) && app.isFinanceApp)
    add('camera_loan', 'Camera/photos access on lending app (sextortion risk)', 10);
  if (hasPerm(app.permissions, OVERLAY_PERMS))
    add('overlay', 'Draw-over-other-apps permission (credential overlay risk)', 15);
  if (hasPerm(app.permissions, INSTALL_PERMS))
    add('install_packages', 'Can install additional APKs silently (dropper risk)', 25);
  if (hasPerm(app.permissions, LOCATION_PERMS) && app.isFinanceApp)
    add('location_loan', 'Precise location access on lending app', 8);

  // Reviews
  if (app.harassmentReviewCount >= 10)
    add('harassment_many', 'Many harassment/blackmail mentions in reviews', 18);
  else if (app.harassmentReviewCount >= 3)
    add('harassment_some', 'Some harassment mentions in reviews', 8);
  if (app.burstReviews) add('burst_reviews', 'Suspicious burst of 5-star reviews', 12);

  // Age
  if (app.publishedDaysAgo !== undefined && app.publishedDaysAgo < 14)
    add('very_new', 'Published less than 14 days ago', 8);
  else if (app.publishedDaysAgo !== undefined && app.publishedDaysAgo < 60)
    add('fairly_new', 'Published less than 60 days ago', 4);

  // No privacy policy
  if (!app.hasPrivacyPolicy) add('no_privacy_policy', 'No privacy policy', 8);

  // Force high-risk floor for unregistered finance apps
  let finalScore = Math.max(0, Math.min(100, raw));
  if (gate === 'unauthorized' || gate === 'unverified') {
    finalScore = Math.max(70, finalScore);
  }

  return { ...app, gate, riskScore: finalScore, firedSignals: signals };
}
