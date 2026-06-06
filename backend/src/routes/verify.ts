import { Router, Request, Response, NextFunction } from 'express';
import { AppProfile, VerifyResponse } from '../../../engine/src/types';
import { getRBIDataset } from '../services/rbi';
import { score } from '../services/scoring';
import { scrapePlayStore, scrapeAppStore, StoreScrapedData } from '../services/store-scraper';
import { checkMalwareBazaar } from '../services/malwarebazaar';
import { searchPlayStoreByName } from '../services/store-scraper';
import db from '../db/database';
import { logger } from '../lib/logger';
import { VerifyRequestInput } from '../lib/schemas';

const router = Router();

const PLAY_STORE_PKG_RE = /[?&]id=([a-z][a-z0-9_]*(\.[a-z0-9_]+)+)/i;

function extractPackageIdFromUrl(url: string): string | undefined {
  const match = PLAY_STORE_PKG_RE.exec(url);
  return match ? match[1] : undefined;
}

function getCommunityReportCount(packageId?: string, appName?: string): number {
  if (packageId) {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM community_reports WHERE package_id = ?')
      .get(packageId) as { count: number };
    return row.count;
  }
  if (appName) {
    const row = db
      .prepare('SELECT COUNT(*) as count FROM community_reports WHERE app_name LIKE ?')
      .get(`%${appName}%`) as { count: number };
    return row.count;
  }
  return 0;
}

/**
 * POST /api/verify
 *
 * Fetches the real Play Store / App Store listing for the given identifier,
 * then scores it against the RBI dataset and risk signals.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as VerifyRequestInput;

    let resolvedPackageId = body.packageId;
    if (!resolvedPackageId && body.url) {
      resolvedPackageId = extractPackageIdFromUrl(body.url);
    }

    // If still no package ID, try searching Play Store by name
    if (!resolvedPackageId && !body.bundleId && body.appName) {
      const found = await searchPlayStoreByName(body.appName);
      if (found) {
        resolvedPackageId = found;
        logger.info('Resolved package ID from Play Store name search', { appName: body.appName, packageId: found });
      }
    }

    // Fetch real store listing and MalwareBazaar check in parallel
    let scraped: StoreScrapedData | null = null;
    let malwareHashListed = false;

    const storePromise = resolvedPackageId
      ? scrapePlayStore(resolvedPackageId).catch((err) => {
          logger.warn('Play Store scrape failed', { packageId: resolvedPackageId, err: err.message });
          return null;
        })
      : body.bundleId
        ? scrapeAppStore(body.bundleId).catch((err) => {
            logger.warn('App Store scrape failed', { bundleId: body.bundleId, err: err.message });
            return null;
          })
        : Promise.resolve(null);

    const mbPromise = body.apkSha256
      ? checkMalwareBazaar(body.apkSha256).then((hit) => {
          if (hit) {
            logger.warn('MalwareBazaar hit', { sha256: body.apkSha256, signature: hit.signature });
            return true;
          }
          return false;
        })
      : Promise.resolve(false);

    [scraped, malwareHashListed] = await Promise.all([storePromise, mbPromise]);

    const appName =
      scraped?.appName ??
      body.appName ??
      resolvedPackageId?.split('.').pop() ??
      body.bundleId ??
      'Unknown App';

    const communityReports = getCommunityReportCount(resolvedPackageId, appName);
    const isSideloaded = body.isSideloaded ?? false;

    // For sideloaded APKs the client sends real APK-parsed permissions — those take priority.
    // For store-installed apps the scraped store listing is authoritative.
    const profile: AppProfile = {
      appName,
      packageId: resolvedPackageId,
      bundleId: scraped?.bundleId ?? body.bundleId,
      permissions: isSideloaded
        ? (body.permissions ?? scraped?.permissions)
        : (scraped?.permissions ?? body.permissions),
      isFinanceApp: scraped?.isFinanceApp ?? body.isFinanceApp,
      declaredPartner: body.declaredPartner,
      publishedDaysAgo: scraped?.publishedDaysAgo ?? body.publishedDaysAgo,
      developerAccountAgeDays: body.developerAccountAgeDays,
      hasPrivacyPolicy: scraped?.hasPrivacyPolicy ?? body.hasPrivacyPolicy,
      hasVerifiableWebsite: scraped?.hasVerifiableWebsite ?? body.hasVerifiableWebsite,
      burstReviews: scraped?.burstReviews ?? body.burstReviews,
      harassmentReviewCount: scraped?.harassmentReviewCount ?? body.harassmentReviewCount,
      isCertInListed: body.isCertInListed,
      supportPhoneCountry: body.supportPhoneCountry,
      communityReports,
      isSideloaded,
      notFoundInPlayStore: isSideloaded && scraped === null,
      apkSizeBytes: body.apkSizeBytes,
      malwareHashListed,
    };

    logger.info('Scoring app', {
      appName: profile.appName,
      packageId: profile.packageId,
      isFinanceApp: profile.isFinanceApp,
      scraped: scraped !== null,
    });

    const dataset = getRBIDataset();
    const result = score(profile, dataset);

    const response: VerifyResponse = { success: true, result };
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

export default router;
