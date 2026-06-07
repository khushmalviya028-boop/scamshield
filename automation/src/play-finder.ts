import gplay from 'google-play-scraper';
import { LoanApp } from './types';

// ── Every naming pattern predatory Indian loan apps use ──────────────────────
const SEARCH_TERMS = [
  // Direct loan
  'instant loan india',
  'personal loan app india',
  'cash loan rupee india',
  'paisa loan app',
  'kredit loan india',
  'quick cash loan india',
  'fast loan india',
  'salary advance app india',
  'short term loan india',
  'emi loan app india',
  // Amount-focused (scam apps love ₹-amount names)
  'micro loan india',
  'mini loan instant',
  '10000 loan instant india',
  '5000 loan instant india',
  '50000 personal loan india',
  // Source pattern
  'online loan india',
  'mobile loan india',
  'aadhar card loan instant',
  'pan card loan india',
  'instant approval personal loan',
  // No-CIBIL pattern (huge scam vector)
  'low cibil score loan india',
  'no credit score loan india',
  'bad credit loan india',
  // Hindi/regional transliteration
  'paisa advance india',
  'turant loan india',
  'tatkal loan india',
  'naya loan app',
  'rupee cash advance india',
  // Business/type pattern
  'lending app india',
  'nbfc loan app india',
  'digital lending india',
  'credit line india',
  'money lending app india',
  'flexi loan india',
  'borrow money india',
  'student loan app india',
  'small business loan india',
  'emergency loan india',
  // Finance category broad
  'finance app india loan',
  'easy cash loan india',
  'fast rupee loan',
  'quick rupee cash',
  'cash on demand india',
];

const FINANCE_GENRES = new Set(['FINANCE']);
const FINANCE_KEYWORDS =
  /\b(loan|lend|credit|emi|borrow|advance|nbfc|rupee|paisa|instant money|personal loan|disburse|kreditbee|cashe|kredit|flexi|moneylion|cashkaro)\b/i;
const HARASSMENT_KEYWORDS =
  /\b(harass|threat|blackmail|morphed|photo|contact.?list|expose|extort|recovery.?agent|abuse|shame|family.?member|boss|colleague)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function findLoanApps(delayMs: number, maxApps: number): Promise<LoanApp[]> {
  const seen = new Map<string, LoanApp>();

  // Phase 1: search all terms, collect unique app IDs
  console.log('\n📡 Phase 1: Searching Play Store...\n');
  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${SEARCH_TERMS.length}] "${term}" ... `);
    try {
      const results: any[] = await gplay.search({ term, num: 50, lang: 'en', country: 'in' });
      let added = 0;
      for (const r of results) {
        if (seen.has(r.appId)) {
          seen.get(r.appId)!.matchedSearchTerms.push(term);
          continue;
        }
        const genreId = (r.genreId ?? '').toUpperCase();
        const isFinance =
          FINANCE_GENRES.has(genreId) ||
          FINANCE_KEYWORDS.test(r.title ?? '') ||
          FINANCE_KEYWORDS.test(r.summary ?? '');
        if (!isFinance) continue;

        seen.set(r.appId, {
          packageId: r.appId,
          appName: r.title ?? r.appId,
          developer: r.developer ?? '',
          developerEmail: '',
          developerWebsite: '',
          genre: r.genre ?? '',
          rating: r.score ?? 0,
          ratingsCount: r.ratings ?? 0,
          installs: r.installs ?? 'Unknown',
          released: '',
          publishedDaysAgo: undefined,
          hasPrivacyPolicy: false,
          permissions: [],
          isFinanceApp: true,
          burstReviews: false,
          harassmentReviewCount: 0,
          summary: r.summary ?? '',
          playStoreUrl: `https://play.google.com/store/apps/details?id=${r.appId}`,
          matchedSearchTerms: [term],
        });
        added++;
      }
      console.log(`${results.length} results, ${added} new finance apps`);
    } catch (err: any) {
      console.log(`⚠️  failed (${err.message?.slice(0, 60)})`);
      await sleep(delayMs * 2);
    }
    await sleep(delayMs);
  }

  let apps = Array.from(seen.values());
  if (maxApps > 0 && apps.length > maxApps) {
    console.log(`\n⚠️  Capping at ${maxApps} apps (found ${apps.length})`);
    apps = apps.slice(0, maxApps);
  }

  // Phase 2: fetch full details
  console.log(`\n🔬 Phase 2: Fetching details for ${apps.length} apps...\n`);
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    process.stdout.write(`\r  [${i + 1}/${apps.length}] ${app.appName.slice(0, 45).padEnd(45)}`);

    try {
      const [detailRes, permRes, reviewRes] = await Promise.allSettled([
        gplay.app({ appId: app.packageId, lang: 'en', country: 'in' }),
        gplay.permissions({ appId: app.packageId, lang: 'en' }),
        (gplay as any).reviews({
          appId: app.packageId,
          sort: (gplay as any).sort?.NEWEST ?? 2,
          num: 50,
          lang: 'en',
        }),
      ]);

      if (detailRes.status === 'fulfilled') {
        const d = detailRes.value as any;
        app.developerEmail = d.developerEmail ?? '';
        app.developerWebsite = d.developerWebsite ?? '';
        app.hasPrivacyPolicy = Boolean(d.privacyPolicy);
        app.released = d.released ?? '';
        if (app.released) {
          const ms = Date.parse(app.released);
          if (!isNaN(ms)) app.publishedDaysAgo = Math.floor((Date.now() - ms) / 86_400_000);
        }
        const gId = (d.genreId ?? '').toUpperCase();
        app.isFinanceApp =
          FINANCE_GENRES.has(gId) ||
          FINANCE_KEYWORDS.test(d.title ?? '') ||
          FINANCE_KEYWORDS.test(d.summary ?? '');
        app.summary = d.summary ?? app.summary;
      }

      if (permRes.status === 'fulfilled') {
        app.permissions = (permRes.value as any[])
          .map((p: any) => p.permission ?? p.type ?? String(p))
          .filter(Boolean);
      }

      if (reviewRes.status === 'fulfilled') {
        const reviews: any[] = (reviewRes.value as any).data ?? [];
        app.harassmentReviewCount = reviews.filter((r) =>
          HARASSMENT_KEYWORDS.test(r.text ?? ''),
        ).length;
        const fiveStars = reviews.filter((r) => r.score === 5).length;
        app.burstReviews = reviews.length >= 20 && fiveStars / reviews.length > 0.8;
      }
    } catch {
      // keep basic data from search result
    }

    await sleep(delayMs);
  }

  console.log('\n');
  return apps;
}
