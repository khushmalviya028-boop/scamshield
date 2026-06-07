import * as fs from 'fs';
import * as path from 'path';
import { LoanApp, RBIDataset, RBIGate } from './types';

const NOISE_WORDS =
  /\b(pvt|ltd|limited|private|technologies|technology|tech|finserv|financial|finance|services|service|india|solutions|solution|ventures|venture|capital|group|holdings|holding|digital|payments|payment)\b/g;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(NOISE_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  if (target.includes(query) || query.includes(target)) return true;
  const maxLen = Math.max(query.length, target.length);
  return levenshtein(query, target) <= Math.min(3, Math.floor(maxLen / 5));
}

export function loadRBIDataset(datasetPath: string): RBIDataset {
  const resolved = path.resolve(__dirname, '..', datasetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`\n❌ RBI dataset not found at: ${resolved}`);
    console.error('   Run: cd ../ingestion && python3 scrape_rbi.py\n');
    process.exit(1);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw) as RBIDataset;
}

export function checkRBIGate(app: LoanApp, dataset: RBIDataset): RBIGate {
  if (!app.isFinanceApp) return 'na';

  const records = dataset.records;
  const normalizedName = normalizeName(app.appName);

  // 1. Exact packageId match
  if (records.some((r) => r.packageId === app.packageId)) return 'authorized';

  // 2. Exact normalized name match
  if (records.some((r) => r.normalizedDlaName === normalizedName)) return 'authorized';

  // 3. Fuzzy name match — close enough = authorized (scam apps rarely use the exact DLA name)
  if (records.some((r) => fuzzyMatch(normalizedName, r.normalizedDlaName))) return 'authorized';

  // 4. Check lending permissions — if present and no NBFC match → unauthorized
  const hasLendingPerms = app.permissions.some(
    (p) =>
      p.toLowerCase().includes('sms') ||
      p.toLowerCase().includes('contacts') ||
      p.toLowerCase().includes('read_contacts') ||
      p.toLowerCase().includes('read_sms'),
  );

  if (hasLendingPerms) return 'unauthorized';

  return 'unverified';
}
