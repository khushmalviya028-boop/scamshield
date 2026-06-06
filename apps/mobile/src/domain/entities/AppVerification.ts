// Core domain entity — what a verification result IS, independent of API or UI
import { z } from 'zod';

export const RiskBandSchema = z.enum(['safe', 'caution', 'high-risk']);
export const RBIGateSchema = z.enum(['authorized', 'unverified', 'unauthorized', 'na']);

export const SignalSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  points: z.number(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  fired: z.boolean(),
});

export const ScoreResultSchema = z.object({
  appName: z.string(),
  packageId: z.string().optional(),
  score: z.number().min(0).max(100),
  band: RiskBandSchema,
  verdictLabel: z.string(),
  gate: RBIGateSchema,
  gateBanner: z.string(),
  gateDetails: z.string(),
  firedSignals: z.array(SignalSchema),
  recommendedAction: z.string(),
});

export const VerifyRequestSchema = z.object({
  url: z.string().optional(),
  packageId: z.string().optional(),
  bundleId: z.string().optional(),
  appName: z.string().optional(),
  declaredPartner: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isFinanceApp: z.boolean().optional(),
  publishedDaysAgo: z.number().optional(),
  developerAccountAgeDays: z.number().optional(),
  hasPrivacyPolicy: z.boolean().optional(),
  hasVerifiableWebsite: z.boolean().optional(),
  burstReviews: z.boolean().optional(),
  harassmentReviewCount: z.number().optional(),
  isCertInListed: z.boolean().optional(),
  supportPhoneCountry: z.string().optional(),
  communityReports: z.number().optional(),
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type RiskBand = z.infer<typeof RiskBandSchema>;
export type RBIGate = z.infer<typeof RBIGateSchema>;
export type Signal = z.infer<typeof SignalSchema>;
