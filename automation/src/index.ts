import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { findLoanApps } from './play-finder';
import { loadRBIDataset, checkRBIGate } from './rbi-checker';
import { scoreApp } from './scorer';
import { sendReport } from './emailer';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');
const NO_EMAIL = ARGS.has('--no-email');
const DELAY_MS = parseInt(process.env.SCRAPE_DELAY_MS ?? '1500');
const MAX_APPS = parseInt(process.env.MAX_APPS ?? '300');
const MIN_SCORE = parseInt(process.env.MIN_RISK_SCORE ?? '40');
const RBI_PATH = process.env.RBI_DATASET_PATH ?? '../backend/data/rbi_dla_dataset.json';
const OUTPUT_DIR = path.join(__dirname, '../outputs');

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   ScamShield — Loan App Scanner                     ║');
  console.log('║   Finds unregistered Indian lending apps             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(`Mode:      ${DRY_RUN ? 'DRY RUN (no email)' : NO_EMAIL ? 'SCAN ONLY (no email)' : 'FULL (scan + email)'}`);
  console.log(`Delay:     ${DELAY_MS}ms between API calls`);
  console.log(`Max apps:  ${MAX_APPS === 0 ? 'unlimited' : MAX_APPS}`);
  console.log(`Min score: ${MIN_SCORE}`);
  console.log(`RBI data:  ${path.resolve(__dirname, '..', RBI_PATH)}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 1. Load RBI dataset
  console.log('📂 Loading RBI DLA dataset...');
  const dataset = loadRBIDataset(RBI_PATH);
  console.log(`   ${dataset.records.length} DLA records, ${dataset.nbfcList.length} NBFCs`);
  console.log(`   Dataset fetched: ${dataset.fetchedAt}\n`);

  // 2. Find loan apps on Play Store
  const rawApps = await findLoanApps(DELAY_MS, MAX_APPS);
  console.log(`📊 Found ${rawApps.length} unique finance/lending apps on Play Store\n`);

  // 3. Score each app
  console.log('⚖️  Scoring apps...');
  const scored = rawApps.map((app) => {
    const gate = checkRBIGate(app, dataset);
    return scoreApp(app, gate);
  });

  // 4. Filter: NOT on RBI list AND above min score threshold
  const flagged = scored
    .filter((a) => (a.gate === 'unverified' || a.gate === 'unauthorized') && a.riskScore >= MIN_SCORE)
    .sort((a, b) => b.riskScore - a.riskScore);

  const authorized = scored.filter((a) => a.gate === 'authorized').length;
  const na = scored.filter((a) => a.gate === 'na').length;

  console.log('\n── Scan Results ─────────────────────────────────────');
  console.log(`   Total apps scanned:        ${rawApps.length}`);
  console.log(`   Authorized (on RBI list):  ${authorized}`);
  console.log(`   Not a lending app:         ${na}`);
  console.log(`   Flagged (NOT on RBI list): ${flagged.length}`);
  console.log('─────────────────────────────────────────────────────\n');

  if (flagged.length === 0) {
    console.log('✅ No apps flagged above the score threshold. All done.\n');
    return;
  }

  // 5. Write JSON output
  const runDate = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(OUTPUT_DIR, `report-${runDate}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalScanned: rawApps.length,
        flaggedCount: flagged.length,
        rbiDatasetDate: dataset.fetchedAt,
        rbiDlaListUrl:
          'https://www.rbi.org.in/Scripts/PublicationReportDetails.aspx?UrlPage=&ID=1308',
        apps: flagged,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`💾 JSON report: ${jsonPath}`);

  // 6. Write CSV output
  const csvPath = path.join(OUTPUT_DIR, `report-${runDate}.csv`);
  const csvHeader =
    'Rank,App Name,Package ID,Developer,Risk Score,RBI Gate,Rating,Ratings Count,Installs,Published Days Ago,Has Privacy Policy,Harassment Reviews,Burst Reviews,Play Store URL,Signals\n';
  const csvRows = flagged
    .map(
      (a, i) =>
        [
          i + 1,
          `"${a.appName.replace(/"/g, '""')}"`,
          a.packageId,
          `"${a.developer.replace(/"/g, '""')}"`,
          a.riskScore,
          a.gate,
          a.rating.toFixed(1),
          a.ratingsCount,
          `"${a.installs}"`,
          a.publishedDaysAgo ?? '',
          a.hasPrivacyPolicy ? 'Yes' : 'No',
          a.harassmentReviewCount,
          a.burstReviews ? 'Yes' : 'No',
          a.playStoreUrl,
          `"${a.firedSignals.map((s) => s.label).join(' | ').replace(/"/g, '""')}"`,
        ].join(','),
    )
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');
  console.log(`💾 CSV  report: ${csvPath}`);

  // 7. Print top 10 to console
  console.log('\n── Top 10 Highest Risk Apps ─────────────────────────');
  flagged.slice(0, 10).forEach((a, i) => {
    const gate = a.gate === 'unauthorized' ? '🚫 UNAUTHORIZED' : '⚠️  UNVERIFIED ';
    console.log(`  ${(i + 1).toString().padStart(2)}. [${a.riskScore}/100] ${gate}  ${a.appName}`);
    console.log(`      ${a.packageId}`);
    console.log(`      ${a.firedSignals.map((s) => s.label).join(' · ')}`);
  });
  console.log('─────────────────────────────────────────────────────\n');

  // 8. Send email
  if (!NO_EMAIL) {
    await sendReport(flagged, rawApps.length, OUTPUT_DIR, DRY_RUN);
  } else {
    console.log('📧 Email skipped (--no-email)');
    // Still save HTML report
    await sendReport(flagged, rawApps.length, OUTPUT_DIR, true);
  }

  console.log('\n✅ Scan complete.\n');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
