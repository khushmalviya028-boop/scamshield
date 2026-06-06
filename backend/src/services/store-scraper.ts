import gplay from 'google-play-scraper';
import https from 'https';
import { logger } from '../lib/logger';

const FINANCE_GENRE_IDS = new Set(['FINANCE', 'FINANCE_AND_BANKING', 'SHOPPING']);
const FINANCE_KEYWORDS =
  /\b(loan|lend|credit|emi|borrow|advance|nbfc|fintech|rupee|paisa|instant money|personal loan|disburse)\b/i;
const HARASSMENT_KEYWORDS =
  /\b(harass|threat|blackmail|recovery.?agent|abuse|extort|contact.?list|embarrass|shame|expose|family.?member|coworker|colleague|boss)\b/i;

export interface StoreScrapedData {
  appName: string;
  packageId?: string;
  bundleId?: string;
  permissions: string[];
  isFinanceApp: boolean;
  publishedDaysAgo?: number;
  hasPrivacyPolicy: boolean;
  hasVerifiableWebsite: boolean;
  burstReviews: boolean;
  harassmentReviewCount: number;
}

function daysSince(dateStr: string): number | undefined {
  const ms = Date.parse(dateStr);
  if (isNaN(ms)) return undefined;
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

export async function scrapePlayStore(packageId: string): Promise<StoreScrapedData> {
  const [appResult, permResult, reviewResult] = await Promise.allSettled([
    gplay.app({ appId: packageId, lang: 'en', country: 'in' }),
    gplay.permissions({ appId: packageId, lang: 'en' }),
    gplay.reviews({ appId: packageId, sort: (gplay as any).sort.NEWEST, num: 100, lang: 'en' }),
  ]);

  if (appResult.status === 'rejected') {
    throw new Error(`Play Store: ${appResult.reason?.message ?? appResult.reason}`);
  }

  const app = appResult.value;

  const permissions: string[] =
    permResult.status === 'fulfilled'
      ? permResult.value
          .map((p: any) => p.permission ?? p.type ?? String(p))
          .filter(Boolean)
      : [];

  if (permResult.status === 'rejected') {
    logger.warn('Play Store permissions fetch failed', { packageId, err: permResult.reason?.message });
  }

  const reviews: any[] =
    reviewResult.status === 'fulfilled' ? reviewResult.value.data ?? [] : [];

  const genreId = (app.genreId ?? '').toUpperCase();
  const isFinanceApp =
    FINANCE_GENRE_IDS.has(genreId) ||
    FINANCE_KEYWORDS.test(app.title) ||
    FINANCE_KEYWORDS.test(app.summary ?? '');

  const harassmentReviewCount = reviews.filter((r) =>
    HARASSMENT_KEYWORDS.test(r.text ?? ''),
  ).length;

  const fiveStarCount = reviews.filter((r) => r.score === 5).length;
  const burstReviews = reviews.length >= 20 && fiveStarCount / reviews.length > 0.8;

  logger.debug('Play Store scrape complete', {
    packageId,
    appName: app.title,
    genreId,
    isFinanceApp,
    permissions: permissions.length,
    reviews: reviews.length,
    harassment: harassmentReviewCount,
  });

  return {
    appName: app.title,
    packageId,
    permissions,
    isFinanceApp,
    publishedDaysAgo: app.released ? daysSince(app.released) : undefined,
    hasPrivacyPolicy: Boolean((app as any).privacyPolicy),
    hasVerifiableWebsite: Boolean(app.developerWebsite),
    burstReviews,
    harassmentReviewCount,
  };
}

export async function scrapeAppStore(bundleId: string): Promise<StoreScrapedData> {
  const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=in&limit=1`;

  const body = await new Promise<string>((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });

  const data = JSON.parse(body);
  if (!data.resultCount || !data.results?.[0]) {
    throw new Error(`App Store: no result for bundleId ${bundleId}`);
  }

  const app = data.results[0];
  const genres: string[] = app.genres ?? [];

  const isFinanceApp =
    genres.some((g: string) => /^finance$/i.test(g)) ||
    FINANCE_KEYWORDS.test(app.trackName ?? '');

  logger.debug('App Store scrape complete', {
    bundleId,
    appName: app.trackName,
    genres,
    isFinanceApp,
  });

  return {
    appName: app.trackName,
    bundleId,
    permissions: [],
    isFinanceApp,
    publishedDaysAgo: app.releaseDate ? daysSince(app.releaseDate) : undefined,
    hasPrivacyPolicy: Boolean(app.privacyPolicyUrl),
    hasVerifiableWebsite: Boolean(app.sellerUrl),
    burstReviews: false,
    harassmentReviewCount: 0,
  };
}
