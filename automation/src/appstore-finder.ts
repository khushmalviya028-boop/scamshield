import https from 'https';
import { LoanApp } from './types';

// ── Every naming pattern predatory Indian loan apps use on the App Store ─────
const SEARCH_TERMS = [
  // ── Broad / generic (cast widest net) ─────────────────────────────────────
  'loan app',
  'loan app india',
  'cash loan',
  'cash loan india',
  'personal loan',
  'personal loan india',
  'credit app',
  'credit app india',
  'lending app',
  'lending app india',
  'borrow money',
  'borrow money india',
  'money loan',
  'finance loan',
  'loan online india',

  // ── Instant / speed ────────────────────────────────────────────────────────
  'instant loan',
  'instant loan india',
  'instant cash loan',
  'instant personal loan',
  'instant money india',
  'instant credit india',
  'quick loan',
  'quick loan india',
  'quick cash india',
  'fast loan',
  'fast loan india',
  'fast cash india',
  'fast money india',
  'same day loan india',
  'urgent loan india',
  'emergency loan',
  'emergency loan india',

  // ── Currency / regional ────────────────────────────────────────────────────
  'rupee loan',
  'rupee loan india',
  'paisa loan',
  'paisa loan india',
  'paisa advance',
  'rupee cash',
  'rupee cash india',
  'cash rupee',
  'inr loan app',

  // ── Specific loan types ────────────────────────────────────────────────────
  'salary advance',
  'salary advance india',
  'salary loan india',
  'salary cash india',
  'emi loan',
  'emi loan india',
  'short term loan',
  'short term loan india',
  'micro loan',
  'micro loan india',
  'mini loan india',
  'small loan india',
  'low amount loan india',
  'student loan india',
  'education loan india',
  'business loan india',
  'shop loan india',
  'flexi loan',
  'flexi loan india',
  'line of credit india',
  'credit line india',
  'overdraft app india',

  // ── No-check / predatory patterns ─────────────────────────────────────────
  'no cibil loan',
  'no cibil loan india',
  'low cibil loan',
  'bad credit loan india',
  'no credit score loan',
  'no credit check loan india',
  'instant approval loan',
  'guaranteed loan india',
  'aadhar loan',
  'aadhar card loan india',
  'pan card loan india',
  'no document loan india',

  // ── App type / process ─────────────────────────────────────────────────────
  'online loan india',
  'mobile loan india',
  'app loan india',
  'digital loan india',
  'nbfc loan',
  'nbfc app india',
  'digital lending india',
  'fintech loan india',

  // ── Hindi transliteration ──────────────────────────────────────────────────
  'tatkal loan',
  'tatkal loan india',
  'turant loan india',
  'naya loan',
  'asaan loan india',
  'jaldi loan india',

  // ── Specific known scam brand patterns ────────────────────────────────────
  'kredit loan',
  'kredit india',
  'kreditbee india',
  'cashe loan india',
  'moneyview loan',
  'lazypay india',
  'stashfin india',
  'paysense india',
  'earlysalary india',
  'cashkaro india',
  'navi loan india',
  'kissht india',
  'moneytap india',
  'zestmoney india',
  'fibe loan india',
  'jupiter credit india',
  'slice credit india',
  'uni card india',
];

const FINANCE_KEYWORDS =
  /\b(loan|lend|credit|emi|borrow|advance|nbfc|rupee|paisa|instant money|personal loan|disburse|kredit|flexi)\b/i;
const HARASSMENT_KEYWORDS =
  /\b(harass|threat|blackmail|morphed|photo|contact.?list|expose|extort|recovery.?agent|abuse|shame|family.?member|boss|colleague)\b/i;
const AGGRESSIVE_LENDING_KEYWORDS =
  /\b(no cibil|no credit check|bad credit|instant disbursal|within minutes|no document|aadhar only|pan only|guaranteed approval|no rejection)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function get(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'ScamShield/1.0' } }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

async function fetchReviews(trackId: number): Promise<any[]> {
  try {
    const url = `https://itunes.apple.com/in/rss/customerreviews/id=${trackId}/sortBy=mostRecent/json`;
    const data = await get(url);
    return data?.feed?.entry ?? [];
  } catch {
    return [];
  }
}

async function fetchAppDetails(trackId: number): Promise<any | null> {
  try {
    const data = await get(
      `https://itunes.apple.com/lookup?id=${trackId}&country=in&entity=software`,
    );
    return data?.results?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function findLoanApps(delayMs: number, maxApps: number): Promise<LoanApp[]> {
  const seen = new Map<number, LoanApp>();

  // Phase 1: search all terms
  console.log('\n📡 Phase 1: Searching App Store (iTunes API)...\n');

  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${SEARCH_TERMS.length}] "${term}" ... `);

    try {
      const encoded = encodeURIComponent(term);
      const data = await get(
        `https://itunes.apple.com/search?term=${encoded}&country=in&entity=software&media=software&limit=200`,
      );

      const results: any[] = data?.results ?? [];
      let added = 0;

      for (const r of results) {
        if (!r.trackId || seen.has(r.trackId)) {
          if (seen.has(r.trackId)) {
            seen.get(r.trackId)!.matchedSearchTerms.push(term);
          }
          continue;
        }

        const genre = r.primaryGenreName ?? '';
        const isFinance =
          genre.toLowerCase() === 'finance' ||
          FINANCE_KEYWORDS.test(r.trackName ?? '') ||
          FINANCE_KEYWORDS.test(r.description ?? '');

        if (!isFinance) continue;

        seen.set(r.trackId, {
          trackId: r.trackId,
          bundleId: r.bundleId ?? '',
          appName: r.trackName ?? '',
          developer: r.artistName ?? r.sellerName ?? '',
          developerUrl: r.sellerUrl ?? '',
          privacyPolicyUrl: r.privacyPolicyUrl ?? '',
          genre,
          rating: r.averageUserRatingForCurrentVersion ?? r.averageUserRating ?? 0,
          ratingsCount: r.userRatingCountForCurrentVersion ?? r.userRatingCount ?? 0,
          releaseDate: r.releaseDate ?? r.currentVersionReleaseDate ?? '',
          publishedDaysAgo: r.releaseDate
            ? Math.floor((Date.now() - Date.parse(r.releaseDate)) / 86_400_000)
            : undefined,
          hasPrivacyPolicy: Boolean(r.privacyPolicyUrl),
          hasVerifiableWebsite: Boolean(r.sellerUrl),
          isFinanceApp: true,
          burstReviews: false,
          harassmentReviewCount: 0,
          description: (r.description ?? '').slice(0, 500),
          appStoreUrl: r.trackViewUrl ?? `https://apps.apple.com/in/app/id${r.trackId}`,
          matchedSearchTerms: [term],
        });
        added++;
      }

      console.log(`${results.length} results, ${added} new finance apps`);
    } catch (err: any) {
      console.log(`⚠️  failed (${err.message?.slice(0, 60)})`);
    }

    await sleep(delayMs);
  }

  let apps = Array.from(seen.values());
  if (maxApps > 0 && apps.length > maxApps) {
    console.log(`\n⚠️  Capping at ${maxApps} apps (found ${apps.length})`);
    apps = apps.slice(0, maxApps);
  }

  // Phase 2: fetch reviews + full details for each app
  console.log(`\n🔬 Phase 2: Fetching details & reviews for ${apps.length} apps...\n`);

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    process.stdout.write(`\r  [${i + 1}/${apps.length}] ${app.appName.slice(0, 50).padEnd(50)}`);

    const [details, reviews] = await Promise.allSettled([
      fetchAppDetails(app.trackId),
      fetchReviews(app.trackId),
    ]);

    if (details.status === 'fulfilled' && details.value) {
      const d = details.value;
      app.privacyPolicyUrl = d.privacyPolicyUrl ?? app.privacyPolicyUrl;
      app.hasPrivacyPolicy = Boolean(app.privacyPolicyUrl);
      app.developerUrl = d.sellerUrl ?? app.developerUrl;
      app.hasVerifiableWebsite = Boolean(app.developerUrl);
      app.description = (d.description ?? app.description).slice(0, 500);
    }

    if (reviews.status === 'fulfilled') {
      const entries: any[] = reviews.value ?? [];
      app.harassmentReviewCount = entries.filter((e) =>
        HARASSMENT_KEYWORDS.test(e?.content?.label ?? ''),
      ).length;
      const fiveStars = entries.filter((e) => e?.['im:rating']?.label === '5').length;
      app.burstReviews = entries.length >= 10 && fiveStars / entries.length > 0.8;
    }

    await sleep(delayMs);
  }

  console.log('\n');
  return apps;
}
