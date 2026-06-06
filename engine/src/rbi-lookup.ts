import { AppProfile, RBIDataset, RBIGate } from './types';

const NOISE_WORDS =
  /\b(pvt|ltd|limited|private|technologies|technology|tech|finserv|financial|finance|services|service|india|solutions|solution|ventures|venture|capital|group|holdings|holding|digital|payments|payment)\b/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(NOISE_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [
    i,
    ...Array(n).fill(0),
  ]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query || !target) return false;
  if (target.includes(query) || query.includes(target)) return true;
  const maxLen = Math.max(query.length, target.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(query, target);
  // Allow 1 edit per 5 chars, max 3 edits
  return dist <= Math.min(3, Math.floor(maxLen / 5));
}

export function lookupRBIGate(profile: AppProfile, dataset: RBIDataset): RBIGate {
  if (!profile.isFinanceApp) return 'na';

  const records = dataset.records;
  const normalizedAppName = normalizeName(profile.appName);
  const normalizedPartner = profile.declaredPartner
    ? normalizeName(profile.declaredPartner)
    : undefined;

  // 1. Exact packageId match
  if (profile.packageId) {
    if (records.some((r) => r.packageId === profile.packageId)) return 'authorized';
  }

  // 2. Exact normalized name match
  if (records.some((r) => r.normalizedDlaName === normalizedAppName)) return 'authorized';

  // 3. Fuzzy name match — similar name lowers risk but never grants full authorization
  // (a scam app named "PhonePe Clone" should NOT get authorized because it fuzzy-matches "PhonePe")

  // 4. Declared partner match
  if (normalizedPartner) {
    const nbfcMatch = dataset.nbfcList.some((nbfc) => {
      const norm = normalizeName(nbfc);
      return norm === normalizedPartner || fuzzyMatch(normalizedPartner, norm);
    });
    if (nbfcMatch) {
      // Partner is a real NBFC but DLA not listed — still unverified
      return 'unverified';
    }
  }

  // No match — determine unauthorized vs unverified
  // We treat 'unauthorized' when there's strong evidence it's a lending app (has lending permissions)
  const hasLendingPermissions = profile.permissions?.some(
    (p) => p.toLowerCase().includes('sms') || p.toLowerCase().includes('contacts'),
  );

  if (hasLendingPermissions && profile.isFinanceApp) {
    return 'unauthorized';
  }

  return 'unverified';
}
