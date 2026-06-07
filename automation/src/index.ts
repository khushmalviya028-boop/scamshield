import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { findLoanApps } from './appstore-finder';
import { loadRBIDataset, checkRBIGate } from './rbi-checker';
import { scoreApp } from './scorer';
import { buildHtmlReport, buildPlainText, previewEmail, sendReport } from './emailer';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ARGS = new Set(process.argv.slice(2));
const SEND = ARGS.has('--send');         // actually send the email
const NO_PREVIEW = ARGS.has('--no-preview'); // skip opening browser
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS ?? '1200');
const MAX_APPS = parseInt(process.env.MAX_APPS ?? '500');
const MIN_SCORE = parseInt(process.env.MIN_RISK_SCORE ?? '40');
const RBI_PATH = process.env.RBI_DATASET_PATH ?? '../backend/data/rbi_dla_dataset.json';
const OUTPUT_DIR = path.join(__dirname, '../outputs');

function askConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase().startsWith('y'));
    });
  });
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║   ScamShield — iOS Loan App Scanner                  ║');
  console.log('║   Finds unregistered Indian lending apps on App Store ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Load RBI dataset
  console.log('📂 Loading RBI DLA dataset...');
  const dataset = loadRBIDataset(RBI_PATH);
  console.log(`   ✓ ${dataset.records.length} DLA records · ${dataset.nbfcList.length} NBFCs`);
  console.log(`   ✓ Dataset date: ${dataset.fetchedAt}\n`);

  // 2. Find apps
  const rawApps = await findLoanApps(DELAY_MS, MAX_APPS);
  console.log(`📊 Found ${rawApps.length} unique iOS finance/lending apps\n`);

  // 3. Score
  console.log('⚖️  Scoring apps against RBI DLA list...');
  const scored = rawApps.map((app) => scoreApp(app, checkRBIGate(app, dataset)));

  // 4. Filter
  const flagged = scored
    .filter((a) => (a.gate === 'unverified' || a.gate === 'unauthorized') && a.riskScore >= MIN_SCORE)
    .sort((a, b) => b.riskScore - a.riskScore);

  const authorized = scored.filter((a) => a.gate === 'authorized').length;

  console.log('\n── Results ──────────────────────────────────────────────');
  console.log(`   Total scanned:             ${rawApps.length}`);
  console.log(`   RBI Authorised:            ${authorized}`);
  console.log(`   Flagged (NOT on RBI list): ${flagged.length}`);
  console.log('─────────────────────────────────────────────────────────\n');

  if (flagged.length === 0) {
    console.log('✅ No apps flagged. All done.\n');
    return;
  }

  // 5. Write JSON + CSV
  const runDate = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(OUTPUT_DIR, `report-${runDate}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        platform: 'ios',
        totalScanned: rawApps.length,
        flaggedCount: flagged.length,
        rbiDatasetDate: dataset.fetchedAt,
        rbiDlaListUrl: 'https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?UrlPage=&ID=1308',
        apps: flagged,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`💾 JSON: ${jsonPath}`);

  const csvPath = path.join(OUTPUT_DIR, `report-${runDate}.csv`);
  const header = 'Rank,App Name,Bundle ID,Developer,Risk Score,RBI Gate,Rating,Ratings Count,Published Days Ago,Has Privacy Policy,Has Website,Harassment Reviews,App Store URL,Signals\n';
  const csvRows = flagged
    .map((a, i) =>
      [
        i + 1,
        `"${a.appName.replace(/"/g, '""')}"`,
        a.bundleId,
        `"${a.developer.replace(/"/g, '""')}"`,
        a.riskScore,
        a.gate,
        a.rating.toFixed(1),
        a.ratingsCount,
        a.publishedDaysAgo ?? '',
        a.hasPrivacyPolicy ? 'Yes' : 'No',
        a.hasVerifiableWebsite ? 'Yes' : 'No',
        a.harassmentReviewCount,
        a.appStoreUrl,
        `"${a.firedSignals.map((s) => s.label).join(' | ').replace(/"/g, '""')}"`,
      ].join(','),
    )
    .join('\n');
  fs.writeFileSync(csvPath, header + csvRows, 'utf8');
  console.log(`💾 CSV:  ${csvPath}\n`);

  // 6. Top 10 preview
  console.log('── Top 10 Highest Risk Apps ─────────────────────────────');
  flagged.slice(0, 10).forEach((a, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${a.riskScore}/100]  ${a.appName}`);
    console.log(`       ${a.bundleId}`);
    console.log(`       ${a.firedSignals.map((s) => s.label).join(' · ')}`);
  });
  console.log('─────────────────────────────────────────────────────────\n');

  // 7. Build email + preview in browser
  const html = buildHtmlReport(flagged, rawApps.length, runDate);
  if (!NO_PREVIEW) {
    await previewEmail(html, OUTPUT_DIR);
  }

  // 8. Ask to send (unless --send flag already passed)
  let shouldSend = SEND;
  if (!SEND && !NO_PREVIEW) {
    console.log('\n──────────────────────────────────────────────────────────');
    const confirmed = await askConfirm('Review the email preview. Send it to reportphishing@apple.com? [y/N]: ');
    shouldSend = confirmed;
  }

  await sendReport(flagged, rawApps.length, OUTPUT_DIR, shouldSend);
  console.log('\n✅ Done.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
