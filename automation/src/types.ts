export interface LoanApp {
  trackId: number;
  bundleId: string;
  appName: string;
  developer: string;
  developerUrl: string;
  privacyPolicyUrl: string;
  genre: string;
  rating: number;
  ratingsCount: number;
  releaseDate: string;
  publishedDaysAgo: number | undefined;
  hasPrivacyPolicy: boolean;
  hasVerifiableWebsite: boolean;
  isFinanceApp: boolean;
  burstReviews: boolean;
  harassmentReviewCount: number;
  description: string;
  appStoreUrl: string;
  matchedSearchTerms: string[];
}

export type RBIGate = 'authorized' | 'unverified' | 'unauthorized' | 'na';

export interface ScoredApp extends LoanApp {
  gate: RBIGate;
  riskScore: number;
  firedSignals: { id: string; label: string; points: number }[];
}

export interface RBIRecord {
  dlaName: string;
  registeredEntity: string;
  packageId: string | null;
  normalizedDlaName: string;
  normalizedEntityName: string;
}

export interface RBIDataset {
  fetchedAt: string;
  records: RBIRecord[];
  nbfcList: string[];
}
