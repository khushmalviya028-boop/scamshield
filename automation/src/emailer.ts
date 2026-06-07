import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { ScoredApp } from './types';

const RBI_DLA_LIST_URL =
  'https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?UrlPage=&ID=1308';

function bandLabel(score: number): string {
  if (score >= 70) return '🔴 HIGH RISK';
  if (score >= 40) return '🟡 CAUTION';
  return '🟢 LOW RISK';
}

function gateLabel(gate: string): string {
  if (gate === 'unauthorized') return '🚫 RBI Unauthorised';
  if (gate === 'unverified') return '⚠️ Not on RBI List';
  if (gate === 'authorized') return '✅ RBI Registered';
  return '—';
}

function permBadges(app: ScoredApp): string {
  const badges: string[] = [];
  const up = app.permissions.map((p) => p.toUpperCase().replace('ANDROID.PERMISSION.', ''));
  const has = (...targets: string[]) => targets.some((t) => up.some((p) => p.includes(t)));

  if (has('READ_SMS', 'RECEIVE_SMS', 'SMS')) badges.push('📩 SMS');
  if (has('READ_CONTACTS', 'CONTACTS')) badges.push('👥 Contacts');
  if (has('CAMERA')) badges.push('📷 Camera');
  if (has('BIND_ACCESSIBILITY_SERVICE')) badges.push('🔴 Accessibility');
  if (has('BIND_DEVICE_ADMIN')) badges.push('🔴 Device Admin');
  if (has('SYSTEM_ALERT_WINDOW')) badges.push('⚠️ Overlay');
  if (has('REQUEST_INSTALL_PACKAGES', 'INSTALL_PACKAGES')) badges.push('📦 Install APKs');
  if (has('ACCESS_FINE_LOCATION')) badges.push('📍 Location');
  return badges.join('  ') || '—';
}

function buildHtmlReport(apps: ScoredApp[], totalScanned: number, runDate: string): string {
  const rows = apps
    .map(
      (a, i) => `
    <tr style="background:${i % 2 === 0 ? '#0d1117' : '#0a0e14'}">
      <td style="padding:10px 12px;font-weight:700;color:#f1f5f9;white-space:nowrap">${i + 1}. ${a.appName}</td>
      <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#94a3b8">${a.packageId}</td>
      <td style="padding:10px 12px;color:#94a3b8">${a.developer}</td>
      <td style="padding:10px 12px;text-align:center;font-weight:800;color:${a.riskScore >= 70 ? '#ef4444' : '#f59e0b'}">${a.riskScore}/100</td>
      <td style="padding:10px 12px;font-size:12px;color:${a.gate === 'unauthorized' ? '#ef4444' : '#f59e0b'}">${gateLabel(a.gate)}</td>
      <td style="padding:10px 12px;font-size:11px;color:#94a3b8">${permBadges(a)}</td>
      <td style="padding:10px 12px;text-align:center">
        <a href="${a.playStoreUrl}" style="color:#6366f1;font-size:12px;text-decoration:none">Play Store ↗</a>
      </td>
    </tr>`,
    )
    .join('');

  const unauthorizedCount = apps.filter((a) => a.gate === 'unauthorized').length;
  const unverifiedCount = apps.filter((a) => a.gate === 'unverified').length;
  const accessibilityCount = apps.filter((a) =>
    a.firedSignals.some((s) => s.id === 'accessibility'),
  ).length;
  const smsContactCount = apps.filter((a) =>
    a.firedSignals.some((s) => s.id === 'contacts_sms_loan'),
  ).length;
  const harassmentCount = apps.filter((a) => a.harassmentReviewCount > 0).length;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ScamShield Report ${runDate}</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9">

<div style="max-width:900px;margin:0 auto;padding:40px 24px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e0505,#2d0a0a);border:1px solid #ef444430;border-radius:16px;padding:32px;margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#ef4444;margin-bottom:12px">
      SCAMSHIELD AUTOMATED SCAN REPORT
    </div>
    <div style="font-size:28px;font-weight:900;color:#f1f5f9;margin-bottom:8px;letter-spacing:-0.5px">
      ${apps.length} Unregistered Indian Lending Apps
    </div>
    <div style="font-size:15px;color:#94a3b8">
      Generated: ${runDate} &nbsp;·&nbsp; ${totalScanned} apps scanned &nbsp;·&nbsp; ${apps.length} flagged
    </div>
  </div>

  <!-- Summary stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px">
    ${[
      ['Total Scanned', totalScanned, '#6366f1'],
      ['NOT on RBI List', apps.length, '#ef4444'],
      ['RBI Unauthorised', unauthorizedCount, '#ef4444'],
      ['Harass. Reports', harassmentCount, '#f59e0b'],
    ]
      .map(
        ([label, val, color]) => `
    <div style="background:#141826;border:1px solid #1e2436;border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:32px;font-weight:900;color:${color};letter-spacing:-1px">${val}</div>
      <div style="font-size:11px;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-top:4px">${label}</div>
    </div>`,
      )
      .join('')}
  </div>

  <!-- RBI context -->
  <div style="background:#0d1f0d;border:1px solid #22c55e30;border-left:4px solid #22c55e;border-radius:12px;padding:24px;margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;color:#22c55e;letter-spacing:1px;margin-bottom:12px">
      📋 HOW TO VERIFY — OFFICIAL RBI DLA LIST
    </div>
    <p style="margin:0 0 12px;color:#94a3b8;line-height:1.6;font-size:14px">
      Every app in this report was cross-checked against the <strong style="color:#f1f5f9">RBI Digital Lending App (DLA) directory</strong> —
      the official list of lending apps authorised under RBI circular <strong style="color:#f1f5f9">RBI/2022-23/111</strong>.
      None of the apps below appear in that registry.
    </p>
    <p style="margin:0 0 16px;color:#94a3b8;line-height:1.6;font-size:14px">
      You can independently verify any app by searching the official list at:
    </p>
    <a href="${RBI_DLA_LIST_URL}"
       style="display:inline-block;background:#22c55e20;border:1px solid #22c55e50;border-radius:8px;padding:10px 18px;color:#22c55e;font-size:13px;font-weight:700;text-decoration:none;font-family:monospace">
      ${RBI_DLA_LIST_URL}
    </a>
  </div>

  <!-- Key risk stats -->
  <div style="background:#141826;border:1px solid #1e2436;border-radius:12px;padding:24px;margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;color:#94a3b8;letter-spacing:1px;margin-bottom:16px">KEY RISK SIGNALS ACROSS ALL FLAGGED APPS</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[
        ['🚫 RBI Unauthorised (lending + no NBFC link)', unauthorizedCount],
        ['⚠️ Not on RBI List (unverified)', unverifiedCount],
        ['🎧 Contacts/SMS access on lending app', smsContactCount],
        ['🔴 Accessibility Service abuse', accessibilityCount],
      ]
        .map(
          ([label, count]) => `
      <div style="background:#0b0f1a;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:#94a3b8;font-size:13px">${label}</span>
        <span style="font-weight:900;color:#ef4444;font-size:16px">${count}</span>
      </div>`,
        )
        .join('')}
    </div>
  </div>

  <!-- Why this matters -->
  <div style="background:#1a1205;border:1px solid #f59e0b30;border-left:4px solid #f59e0b;border-radius:12px;padding:24px;margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;color:#f59e0b;letter-spacing:1px;margin-bottom:12px">WHY THIS IS SERIOUS</div>
    <p style="margin:0 0 10px;color:#94a3b8;font-size:14px;line-height:1.6">
      Unregistered digital lending apps operating in India are the primary vector for a documented wave of borrower harassment and financial fraud:
    </p>
    <ul style="margin:0;padding-left:20px;color:#94a3b8;font-size:14px;line-height:1.8">
      <li>Apps harvest contacts and SMS, then threaten to message family/employers if repayments are missed</li>
      <li>Camera access is used to collect intimate photos, which are then used for sextortion blackmail</li>
      <li>Accessibility Service grants full screen capture — passwords, OTPs, and UPI PINs across all banking apps</li>
      <li>Device Administrator rights prevent uninstallation, trapping victims</li>
      <li>Indian law enforcement (CERT-In, RBI, CBI) has documented hundreds of deaths and thousands of harassment cases linked to apps of this profile</li>
    </ul>
  </div>

  <!-- App table -->
  <div style="margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;color:#94a3b8;letter-spacing:1px;margin-bottom:16px">
      FLAGGED APPS — FULL LIST (${apps.length} apps, sorted by risk score)
    </div>
    <div style="overflow-x:auto;border-radius:12px;border:1px solid #1e2436">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#141826">
            <th style="padding:12px;text-align:left;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">App Name</th>
            <th style="padding:12px;text-align:left;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">Package ID</th>
            <th style="padding:12px;text-align:left;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">Developer</th>
            <th style="padding:12px;text-align:center;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">Score</th>
            <th style="padding:12px;text-align:left;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">RBI Status</th>
            <th style="padding:12px;text-align:left;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">Dangerous Permissions</th>
            <th style="padding:12px;text-align:center;color:#64748b;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px">Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>

  <!-- Methodology -->
  <div style="background:#141826;border:1px solid #1e2436;border-radius:12px;padding:24px;margin-bottom:32px">
    <div style="font-size:13px;font-weight:800;color:#94a3b8;letter-spacing:1px;margin-bottom:12px">METHODOLOGY</div>
    <ol style="margin:0;padding-left:20px;color:#94a3b8;font-size:13px;line-height:1.8">
      <li>Searched Google Play Store (country=IN) for <strong style="color:#f1f5f9">40+ loan/lending search terms</strong> in English and transliterated Hindi</li>
      <li>Collected unique finance-genre apps and fetched full details including permissions and reviews</li>
      <li>Cross-checked each app against the <strong style="color:#f1f5f9">RBI Digital Lending App (DLA) dataset</strong> using exact package ID, normalized name, and fuzzy matching</li>
      <li>Scored each app using ScamShield's signal engine (RBI gate, permissions, review patterns, developer age, privacy policy)</li>
      <li>Included apps scoring ≥40 that are NOT found in the RBI DLA directory</li>
    </ol>
    <p style="margin:12px 0 0;color:#64748b;font-size:12px">
      RBI dataset source: ${RBI_DLA_LIST_URL}<br>
      Scanner: ScamShield Automated Loan App Scanner (scamshield.ai)
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0;border-top:1px solid #1e2436">
    <div style="font-size:18px;font-weight:900;color:#6366f1;margin-bottom:4px">ScamShield</div>
    <div style="font-size:12px;color:#64748b">
      scamshield.ai &nbsp;·&nbsp; Protecting Indian users from predatory apps<br>
      Report generated automatically. Contact: khushal@scalemetrics.ai
    </div>
  </div>

</div>
</body>
</html>`;
}

function buildPlainText(apps: ScoredApp[], totalScanned: number, runDate: string): string {
  const lines = [
    'SCAMSHIELD AUTOMATED SCAN REPORT',
    '================================',
    `Generated: ${runDate}`,
    `Apps scanned: ${totalScanned}`,
    `Apps flagged (not on RBI DLA list): ${apps.length}`,
    '',
    'VERIFY AGAINST OFFICIAL RBI DLA LIST:',
    RBI_DLA_LIST_URL,
    '',
    '--- FLAGGED APPS ---',
    '',
  ];

  apps.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.appName}`);
    lines.push(`   Package ID: ${a.packageId}`);
    lines.push(`   Developer:  ${a.developer}`);
    lines.push(`   Risk Score: ${a.riskScore}/100`);
    lines.push(`   RBI Status: ${gateLabel(a.gate)}`);
    lines.push(`   Play Store: ${a.playStoreUrl}`);
    if (a.firedSignals.length) {
      lines.push(`   Signals:    ${a.firedSignals.map((s) => s.label).join(' | ')}`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push('ScamShield · scamshield.ai · Contact: khushal@scalemetrics.ai');
  return lines.join('\n');
}

export async function sendReport(
  apps: ScoredApp[],
  totalScanned: number,
  outputDir: string,
  dryRun: boolean,
): Promise<void> {
  const runDate = new Date().toISOString().split('T')[0];
  const subject = `[ScamShield] ${apps.length} Unregistered Indian Lending Apps Found — ${runDate}`;
  const html = buildHtmlReport(apps, totalScanned, runDate);
  const text = buildPlainText(apps, totalScanned, runDate);

  // Always write email to file as backup
  const emailPath = path.join(outputDir, `email-${runDate}.html`);
  fs.writeFileSync(emailPath, html, 'utf8');
  console.log(`📄 Email HTML saved: ${emailPath}`);

  if (dryRun) {
    console.log('🔔 Dry-run mode — email not sent. HTML saved to output directory.');
    return;
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn(
      '⚠️  SMTP_USER / SMTP_PASS not set in .env — email not sent. HTML saved to output directory.',
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPass },
  });

  const to = process.env.TO_EMAIL ?? 'reportphishing@apple.com';
  const from = `"${process.env.FROM_NAME ?? 'ScamShield Scanner'}" <${process.env.FROM_EMAIL ?? smtpUser}>`;

  console.log(`\n📧 Sending report to ${to} ...`);
  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`✅ Email sent — Message ID: ${info.messageId}`);
  } catch (err: any) {
    console.error(`❌ Email send failed: ${err.message}`);
    console.error('   HTML saved to output directory — send it manually.');
  }
}
