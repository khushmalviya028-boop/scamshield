export type RiskBand = 'safe' | 'caution' | 'high-risk';
export type RBIGate = 'authorized' | 'unverified' | 'unauthorized' | 'na';

export interface Signal {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fired: boolean;
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
}

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Scanning: { appName: string; packageId?: string; url?: string; request: VerifyRequest };
  Verdict: { result: ScoreResult };
  TakeDown: { result: ScoreResult };
  Report: { appName: string; packageId?: string; result?: ScoreResult };
  Emergency: undefined;
};
