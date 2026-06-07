export interface LoanApp {
  packageId: string;
  appName: string;
  developer: string;
  developerEmail: string;
  developerWebsite: string;
  genre: string;
  rating: number;
  ratingsCount: number;
  installs: string;
  released: string;
  publishedDaysAgo: number | undefined;
  hasPrivacyPolicy: boolean;
  permissions: string[];
  isFinanceApp: boolean;
  burstReviews: boolean;
  harassmentReviewCount: number;
  summary: string;
  playStoreUrl: string;
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
