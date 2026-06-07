import nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ScoredApp } from './types';

const RBI_DLA_LIST_URL =
  'https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?UrlPage=&ID=1308';

function gateLabel(gate: string): string {
  if (gate === 'unauthorized') return '🚫 RBI Unauthorised';
  if (gate === 'unverified') return '⚠️ Not on RBI List';
  if (gate === 'authorized') return '✅ RBI Registered';
  return '—';
}

function gateCellColor(gate: string): string {
  if (gate === 'unauthorized') return '#ef4444';
  if (gate === 'unverified') return '#f59e0b';
  return '#22c55e';
}

export function buildHtmlReport(apps: ScoredApp[], totalScanned: number, runDate: string): string {
  const unauthorizedCount = apps.filter((a) => a.gate === 'unauthorized').length;
  const noPrivacyCount = apps.filter((a) => !a.hasPrivacyPolicy).length;
  const harassmentCount = apps.filter((a) => a.harassmentReviewCount > 0).length;
  const newAppCount = apps.filter(
    (a) => a.publishedDaysAgo !== undefined && a.publishedDaysAgo < 60,
  ).length;

  const rows = apps
    .map(
      (a, i) => `
      <tr style="background:${i % 2 === 0 ? '#0d1117' : '#0a0e14'};border-bottom:1px solid #1e2436">
        <td style="padding:10px 14px;font-weight:700;color:#f1f5f9">${i + 1}</td>
        <td style="padding:10px 14px">
          <div style="font-weight:700;color:#f1f5f9;margin-bottom:2px">${a.appName}</div>
          <div style="font-family:monospace;font-size:11px;color:#64748b">${a.bundleId}</div>
        </td>
        <td style="padding:10px 14px;color:#94a3b8;font-size:13px">${a.developer}</td>
        <td style="padding:10px 14px;text-align:center;font-weight:900;font-size:16px;color:${a.riskScore >= 70 ? '#ef4444' : '#f59e0b'}">${a.riskScore}</td>
        <td style="padding:10px 14px;font-size:12px;font-weight:700;color:${gateCellColor(a.gate)}">${gateLabel(a.gate)}</td>
        <td style="padding:10px 14px;font-size:12px;color:#64748b">${a.hasPrivacyPolicy ? '✅' : '❌ Missing'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#94a3b8">${a.publishedDaysAgo !== undefined ? `${a.publishedDaysAgo}d ago` : '—'}</td>
        <td style="padding:10px 14px;text-align:center">
          <a href="${a.appStoreUrl}" style="background:#6366f120;border:1px solid #6366f140;border-radius:6px;padding:4px 10px;color:#818cf8;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap">App Store ↗</a>
        </td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ScamShield iOS App Store Report — ${runDate}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f1f5f9">
<div style="max-width:960px;margin:0 auto;padding:40px 24px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e0505,#2d0505,#0b0f1a);border:1px solid #ef444430;border-radius:16px;padding:36px;margin-bottom:28px">
    <div style="font-size:11px;font-weight:800;letter-spacing:3px;color:#ef4444;margin-bottom:10px;text-transform:uppercase">
      ScamShield · iOS App Store Report · Automated Scan
    </div>
    <h1 style="margin:0 0 8px;font-size:30px;font-weight:900;color:#f1f5f9;letter-spacing:-0.5px">
      ${apps.length} Unregistered Indian Lending Apps Found on iOS App Store
    </h1>
    <p style="margin:0;font-size:14px;color:#94a3b8">
      Scan date: <strong style="color:#f1f5f9">${runDate}</strong>
      &nbsp;·&nbsp; Apps scanned: <strong style="color:#f1f5f9">${totalScanned}</strong>
      &nbsp;·&nbsp; Flagged: <strong style="color:#ef4444">${apps.length}</strong>
      &nbsp;·&nbsp; Platform: <strong style="color:#f1f5f9">iOS (Apple App Store, country=IN)</strong>
    </p>
  </div>

  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
    ${[
      ['Total Scanned', String(totalScanned), '#6366f1'],
      ['Flagged', String(apps.length), '#ef4444'],
      ['RBI Unauthorised', String(unauthorizedCount), '#ef4444'],
      ['No Privacy Policy', String(noPrivacyCount), '#f59e0b'],
    ]
      .map(
        ([label, val, color]) => `
    <div style="background:#141826;border:1px solid #1e2436;border-radius:12px;padding:20px;text-align:center">
      <div style="font-size:30px;font-weight:900;color:${color};letter-spacing:-1px;line-height:1">${val}</div>
      <div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-top:6px">${label}</div>
    </div>`,
      )
      .join('')}
  </div>

  <!-- RBI verification box -->
  <div style="background:#0d1f0d;border:1px solid #22c55e30;border-left:4px solid #22c55e;border-radius:12px;padding:24px;margin-bottom:28px">
    <div style="font-size:11px;font-weight:800;color:#22c55e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">
      📋 Cross-Verify Against the Official RBI DLA List
    </div>
    <p style="margin:0 0 14px;color:#94a3b8;font-size:14px;line-height:1.6">
      Every app in this report was checked against the <strong style="color:#f1f5f9">RBI Digital Lending App (DLA) directory</strong> —
      the official registry mandated under RBI circular <strong style="color:#f1f5f9">RBI/2022-23/111</strong>.
      None of the apps below appear in that registry. You can independently verify any app here:
    </p>
    <a href="${RBI_DLA_LIST_URL}"
       style="display:inline-block;background:#22c55e15;border:1px solid #22c55e40;border-radius:8px;padding:10px 18px;color:#22c55e;font-size:13px;font-weight:700;text-decoration:none;word-break:break-all">
      ${RBI_DLA_LIST_URL}
    </a>
  </div>

  <!-- Why serious -->
  <div style="background:#1a1205;border:1px solid #f59e0b25;border-left:4px solid #f59e0b;border-radius:12px;padding:24px;margin-bottom:28px">
    <div style="font-size:11px;font-weight:800;color:#f59e0b;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">
      Why This Requires Urgent Action
    </div>
    <p style="margin:0 0 10px;color:#94a3b8;font-size:14px;line-height:1.6">
      These are not hypothetical risks. Indian law enforcement (CERT-In, RBI, ED, CBI) has documented thousands of cases of borrower harassment and dozens of deaths linked to apps of this profile:
    </p>
    <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:14px;line-height:1.9">
      <li>Apps harvest contact lists and threaten to message family, employers, and friends if repayments are missed</li>
      <li>Lenders use camera/photo access to collect intimate images for sextortion blackmail</li>
      <li>Interest rates reach 300–1000% APR with illegal recovery tactics</li>
      <li>Operating a digital lending app in India without RBI authorisation is a criminal offence under the RBI Act</li>
    </ul>
  </div>

  <!-- App table -->
  <div style="margin-bottom:28px">
    <div style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px">
      Flagged Apps — Full List (${apps.length} apps · sorted by risk score)
    </div>
    <div style="overflow-x:auto;border:1px solid #1e2436;border-radius:12px">
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead>
          <tr style="background:#141826">
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">#</th>
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">App / Bundle ID</th>
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Developer</th>
            <th style="padding:11px 14px;text-align:center;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Score</th>
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">RBI Status</th>
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Privacy</th>
            <th style="padding:11px 14px;text-align:left;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Age</th>
            <th style="padding:11px 14px;text-align:center;color:#64748b;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Link</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>

  <!-- Methodology -->
  <div style="background:#141826;border:1px solid #1e2436;border-radius:12px;padding:24px;margin-bottom:28px">
    <div style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px">Methodology</div>
    <ol style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.9">
      <li>Searched <strong style="color:#f1f5f9">Apple App Store (country=IN)</strong> via iTunes Search API for <strong style="color:#f1f5f9">107 loan/lending search terms</strong> in English and transliterated Hindi</li>
      <li>Filtered to apps in the Finance genre or whose name/description matches lending keywords</li>
      <li>Fetched full app details (privacy policy, developer website, release date) and reviews for each</li>
      <li>Cross-checked against the <strong style="color:#f1f5f9">RBI Digital Lending App dataset</strong> using exact bundle ID, normalised name, and fuzzy matching</li>
      <li>Scored each app (RBI gate, description language, privacy policy, developer trust, review harassment signals)</li>
      <li>Included only apps scoring ≥40 that are <strong style="color:#f1f5f9">NOT</strong> found in the RBI DLA directory</li>
    </ol>
    <p style="margin:14px 0 0;font-size:11px;color:#475569;line-height:1.6">
      RBI DLA source: <a href="${RBI_DLA_LIST_URL}" style="color:#6366f1">${RBI_DLA_LIST_URL}</a><br>
      Scanner: ScamShield Automated iOS Loan App Scanner (scamshield.ai) · ${runDate}
    </p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0;border-top:1px solid #1e2436">
    <div style="font-size:20px;font-weight:900;color:#6366f1;margin-bottom:6px">ScamShield</div>
    <div style="font-size:12px;color:#475569;line-height:1.8">
      scamshield.ai &nbsp;·&nbsp; Protecting Indian users from predatory financial apps<br>
      This report was generated automatically. Contact: <a href="mailto:khushal@scalemetrics.ai" style="color:#6366f1">khushal@scalemetrics.ai</a>
    </div>
  </div>

</div>
</body>
</html>`;
}

export function buildPlainText(apps: ScoredApp[], totalScanned: number, runDate: string): string {
  const lines = [
    'SCAMSHIELD — iOS APP STORE SCAN REPORT',
    '======================================',
    `Scan date:     ${runDate}`,
    `Apps scanned:  ${totalScanned}`,
    `Apps flagged:  ${apps.length} (not on RBI DLA list)`,
    '',
    'OFFICIAL RBI DLA LIST (for cross-verification):',
    RBI_DLA_LIST_URL,
    '',
    '─── FLAGGED APPS ────────────────────────────────',
    '',
  ];

  apps.forEach((a, i) => {
    lines.push(`${i + 1}. ${a.appName}`);
    lines.push(`   Bundle ID:   ${a.bundleId}`);
    lines.push(`   Developer:   ${a.developer}`);
    lines.push(`   Risk Score:  ${a.riskScore}/100`);
    lines.push(`   RBI Status:  ${gateLabel(a.gate)}`);
    lines.push(`   App Store:   ${a.appStoreUrl}`);
    if (a.firedSignals.length)
      lines.push(`   Signals:     ${a.firedSignals.map((s) => s.label).join(' | ')}`);
    lines.push('');
  });

  lines.push('─────────────────────────────────────────────────');
  lines.push('ScamShield · scamshield.ai · khushal@scalemetrics.ai');
  return lines.join('\n');
}

export async function previewEmail(htmlContent: string, outputDir: string): Promise<string> {
  const previewPath = path.join(outputDir, 'email-preview.html');
  fs.writeFileSync(previewPath, htmlContent, 'utf8');
  console.log(`\n👁️  Email preview saved: ${previewPath}`);
  try {
    execSync(`open "${previewPath}"`);
    console.log('   Opened in browser for review.');
  } catch {
    console.log('   Open the file above in your browser to review.');
  }
  return previewPath;
}

export async function sendReport(
  apps: ScoredApp[],
  totalScanned: number,
  outputDir: string,
  send: boolean,
): Promise<void> {
  const runDate = new Date().toISOString().split('T')[0];
  const subject = `[ScamShield] ${apps.length} Unregistered Indian Lending Apps on iOS App Store — ${runDate}`;
  const html = buildHtmlReport(apps, totalScanned, runDate);
  const text = buildPlainText(apps, totalScanned, runDate);

  // Save final HTML
  const htmlPath = path.join(outputDir, `email-${runDate}.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  if (!send) {
    console.log(`\n📧 Email ready — not sent (preview mode).`);
    console.log(`   To:      reportphishing@apple.com`);
    console.log(`   Subject: ${subject}`);
    console.log(`   File:    ${htmlPath}`);
    return;
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn('\n⚠️  SMTP_USER / SMTP_PASS not in .env — email not sent. Add credentials and run with --send.');
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

  console.log(`\n📧 Sending to ${to} ...`);
  try {
    const info = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`✅ Sent — Message-ID: ${info.messageId}`);
  } catch (err: any) {
    console.error(`❌ Send failed: ${err.message}`);
  }
}
