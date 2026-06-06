export type RiskBand = 'safe' | 'caution' | 'high-risk';
export type RBIGate = 'authorized' | 'unverified' | 'unauthorized' | 'na';

export interface AppProfile {
  packageId?: string;
  bundleId?: string;
  appName: string;
  normalizedName?: string;
  storeUrl?: string;
  developerName?: string;
  permissions?: string[];
  declaredPartner?: string;
  publishedDaysAgo?: number;
  developerAccountAgeDays?: number;
  hasPrivacyPolicy?: boolean;
  hasVerifiableWebsite?: boolean;
  supportPhoneCountry?: string;
  burstReviews?: boolean;
  harassmentReviewCount?: number;
  communityReports?: number;
  isCertInListed?: boolean;
  isFinanceApp?: boolean;
  reviewsCount?: number;
  averageRating?: number;
  isSideloaded?: boolean;
  notFoundInPlayStore?: boolean;
  apkSizeBytes?: number;
  malwareHashListed?: boolean;
}

export interface Signal {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fired: boolean;
}

export interface RBIRecord {
  dlaName: string;
  registeredEntity: string;
  packageId?: string;
  normalizedDlaName: string;
  normalizedEntityName: string;
}

export interface RBIDataset {
  fetchedAt: string;
  recordCount: number;
  sourceUrl: string;
  disclaimer: string;
  records: RBIRecord[];
  nbfcList: string[];
}

export interface ScoreResult {
  appName: string;
  packageId?: string;
  score: number;
  band: RiskBand;
  verdictLabel: string;
  gate: RBIGate;
  gateBanner: string;
  gateDetails: string;
  firedSignals: Signal[];
  recommendedAction: string;
}

export interface VerifyRequest {
  url?: string;
  packageId?: string;
  bundleId?: string;
  appName?: string;
  declaredPartner?: string;
  permissions?: string[];
  isFinanceApp?: boolean;
  publishedDaysAgo?: number;
  developerAccountAgeDays?: number;
  hasPrivacyPolicy?: boolean;
  hasVerifiableWebsite?: boolean;
  burstReviews?: boolean;
  harassmentReviewCount?: number;
  isCertInListed?: boolean;
  supportPhoneCountry?: string;
  communityReports?: number;
  isSideloaded?: boolean;
  apkSizeBytes?: number;
}

export interface VerifyResponse {
  success: boolean;
  result?: ScoreResult;
  error?: string;
}
