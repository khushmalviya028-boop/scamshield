import { z } from 'zod';

export const VerifyRequestSchema = z.object({
  url: z.string().url().optional(),
  packageId: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/).optional(),
  bundleId: z.string().optional(),
  appName: z.string().min(1).max(200).optional(),
  declaredPartner: z.string().optional(),
  permissions: z.array(z.string()).max(100).optional(),
  isFinanceApp: z.boolean().optional(),
  publishedDaysAgo: z.number().min(0).max(36500).optional(),
  developerAccountAgeDays: z.number().min(0).max(36500).optional(),
  hasPrivacyPolicy: z.boolean().optional(),
  hasVerifiableWebsite: z.boolean().optional(),
  burstReviews: z.boolean().optional(),
  harassmentReviewCount: z.number().min(0).max(100000).optional(),
  isCertInListed: z.boolean().optional(),
  supportPhoneCountry: z.string().length(2).optional(),
  communityReports: z.number().min(0).optional(),
  isSideloaded: z.boolean().optional(),
  apkSizeBytes: z.number().min(0).optional(),
  apkSha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).refine(
  (data) => data.url || data.packageId || data.bundleId || data.appName,
  { message: 'At least one identifier required: url, packageId, bundleId, or appName' }
);

export const ReportSchema = z.object({
  packageId: z.string().optional(),
  appName: z.string().min(1).max(200),
  reportType: z.enum(['scam', 'harassment', 'fake', 'data-theft', 'other']),
  description: z.string().max(2000).optional(),
});

export type VerifyRequestInput = z.infer<typeof VerifyRequestSchema>;
export type ReportInput = z.infer<typeof ReportSchema>;
