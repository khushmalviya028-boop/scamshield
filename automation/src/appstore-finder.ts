import https from 'https';
import { LoanApp } from './types';

const SEARCH_TERMS = [
  // Generic
  'loan app india',
  'cash loan india',
  'personal loan india',
  'lending app india',
  'borrow money india',
  'instant loan india',
  'instant cash loan',
  'quick loan india',
  'fast loan india',
  'emergency loan india',

  // Currency / regional
  'rupee loan',
  'paisa loan',
  'paisa advance',
  'rupee cash loan',

  // Loan types
  'salary advance india',
  'salary loan india',
  'emi loan india',
  'short term loan india',
  'micro loan india',
  'mini loan india',
  'small loan india',
  'student loan india',
  'business loan india',
  'flexi loan india',

  // Predatory / no-check patterns
  'no cibil loan india',
  'bad credit loan india',
  'instant approval loan india',
  'guaranteed loan india',
  'aadhar loan india',
  'no document loan india',

  // App type
  'online loan india',
  'mobile loan india',
  'digital loan india',
  'nbfc loan india',
  'fintech loan india',

  // Hindi transliteration
  'tatkal loan',
  'turant loan india',
  'asaan loan india',
  'jaldi loan india',

  // Known scam brand patterns
  'kredit loan',
  'kreditbee',
  'cashe loan',
  'moneyview loan',
  'lazypay loan',
  'stashfin loan',
  'paysense loan',
  'kissht loan',
  'zestmoney loan',
  'fibe loan',
  'navi loan',
];

// App NAME must contain a direct cash-lending keyword
const CASH_LOAN_NAME =
  /\b(loan|lend|kredit|kred|borrow|paylater|pay.later|disburse)\b|instant\s+(cash|money|loan)|cash\s+(loan|advance|now)|quick\s+(loan|cash|money|paisa)|personal\s+loan|salary\s+advance|flexi\s*(cash|loan)/i;

// If the name matches any of these, it is NOT primarily a cash loan app
const NOT_LOAN_APP =
  /\b(calculator|bank(?:ing)?|insur(?:ance|e)|invest(?:ment|ing|or)?|mutual\s+fund|sip\b|stock|demat|broker|trad(?:e|ing)|forex|crypto|bitcoin|recharge|shop(?:ping)?|news|score\b|bureau|wallet|guide|compar(?:e|ison)|tracker|planner|monitor|report(?:ing)?|marketplace|aggregator|manager\b(?!.*loan))\b/i;

// Known big non-loan platforms to skip by bundle ID prefix or developer name
const SKIP_DEVELOPER =
  /\b(google|amazon|flipkart|paytm|phonepe|bharat\s*pe|zerodha|upstox|angel\s*one|moneycontrol|airtel|cars24|cred(?!it\s*(sea|now|bee|plus))|hdfc\s*bank|icici\s*bank|kotak\s*bank|sbi\b|axis\s*bank|canara|punjab\s*national|bank\s*of\s*baroda|yes\s*bank|indusind|federal\s*bank|union\s*bank|indian\s*bank)\b/i;

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

async function getWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await get(url);
    } catch (e: any) {
      if (attempt < maxRetries - 1) {
        await sleep(3000 * (attempt + 1));
      } else {
        throw e;
      }
    }
  }
}

async function fetchReviews(trackId: number): Promise<any[]> {
  try {
    const url = `https://itunes.apple.com/in/rss/customerreviews/id=${trackId}/sortBy=mostRecent/json`;
    const data = await get(url);
    const entry = data?.feed?.entry;
    if (!entry) return [];
    return Array.isArray(entry) ? entry : [entry];
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

function isCashLoanApp(name: string, developer: string, genre: string): boolean {
  // Must be in Finance genre
  if (genre.toLowerCase() !== 'finance') return false;
  // Name must have a direct lending keyword
  if (!CASH_LOAN_NAME.test(name)) return false;
  // Exclude if name suggests it's not a loan disburser
  if (NOT_LOAN_APP.test(name)) return false;
  // Exclude known non-loan platforms by developer name
  if (SKIP_DEVELOPER.test(developer)) return false;
  return true;
}

export async function findLoanApps(delayMs: number, maxApps: number): Promise<LoanApp[]> {
  const seen = new Map<number, LoanApp>();

  console.log('\n📡 Phase 1: Searching App Store (iPhone, country=IN)...\n');

  for (let i = 0; i < SEARCH_TERMS.length; i++) {
    const term = SEARCH_TERMS[i];
    process.stdout.write(`  [${i + 1}/${SEARCH_TERMS.length}] "${term}" ... `);

    try {
      const encoded = encodeURIComponent(term);
      // entity=software → iPhone/iPod touch apps only
      const data = await getWithRetry(
        `https://itunes.apple.com/search?term=${encoded}&country=in&entity=software&limit=200`,
      );

      const results: any[] = data?.results ?? [];
      let added = 0;

      for (const r of results) {
        if (!r.trackId) continue;

        const name = r.trackName ?? '';
        const developer = r.artistName ?? r.sellerName ?? '';
        const genre = r.primaryGenreName ?? '';

        if (seen.has(r.trackId)) {
          seen.get(r.trackId)!.matchedSearchTerms.push(term);
          continue;
        }

        if (!isCashLoanApp(name, developer, genre)) continue;

        seen.set(r.trackId, {
          trackId: r.trackId,
          bundleId: r.bundleId ?? '',
          appName: name,
          developer,
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

      console.log(`${results.length} results, ${added} new cash loan apps`);
    } catch (err: any) {
      console.log(`⚠️  failed (${err.message?.slice(0, 60)})`);
    }

    await sleep(delayMs);
  }

  let apps = Array.from(seen.values());
  console.log(`\n✅ Phase 1 complete: ${apps.length} unique iPhone cash loan apps found`);

  if (maxApps > 0 && apps.length > maxApps) {
    console.log(`⚠️  Capping at ${maxApps} apps`);
    apps = apps.slice(0, maxApps);
  }

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
      const entries = reviews.value ?? [];
      app.harassmentReviewCount = entries.filter((e: any) =>
        HARASSMENT_KEYWORDS.test(e?.content?.label ?? ''),
      ).length;
      const fiveStars = entries.filter((e: any) => e?.['im:rating']?.label === '5').length;
      app.burstReviews = entries.length >= 10 && fiveStars / entries.length > 0.8;
    }

    await sleep(delayMs);
  }

  console.log('\n');
  return apps;
}
