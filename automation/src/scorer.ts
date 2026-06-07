import { LoanApp, RBIGate, ScoredApp } from './types';

const AGGRESSIVE_KEYWORDS =
  /\b(no cibil|no credit check|bad credit ok|instant disbursal|within minutes|no document|aadhar only|pan only|guaranteed approval|no rejection|100% approval|no collateral required)\b/i;

export function scoreApp(app: LoanApp, gate: RBIGate): ScoredApp {
  const signals: { id: string; label: string; points: number }[] = [];
  let raw = 0;

  const add = (id: string, label: string, points: number) => {
    signals.push({ id, label, points });
    raw += points;
  };

  // RBI gate — primary signal
  if (gate === 'unauthorized') add('rbi_unauthorized', 'Fails RBI registration check', 55);
  else if (gate === 'unverified') add('rbi_unverified', 'Not found in RBI DLA directory', 14);

  // Description content — predatory language
  if (AGGRESSIVE_KEYWORDS.test(app.description))
    add('aggressive_description', 'Description uses predatory lending language (no CIBIL, instant approval, etc.)', 15);

  // Trust signals (negative score = missing legitimate credentials)
  if (!app.hasPrivacyPolicy) add('no_privacy_policy', 'No privacy policy', 8);
  if (!app.hasVerifiableWebsite) add('no_website', 'No verifiable developer website', 5);

  // App age
  if (app.publishedDaysAgo !== undefined && app.publishedDaysAgo < 14)
    add('very_new', 'Published less than 14 days ago', 8);
  else if (app.publishedDaysAgo !== undefined && app.publishedDaysAgo < 60)
    add('fairly_new', 'Published less than 60 days ago', 4);

  // Reviews
  if (app.harassmentReviewCount >= 5)
    add('harassment_many', 'Many harassment/blackmail mentions in reviews', 18);
  else if (app.harassmentReviewCount >= 2)
    add('harassment_some', 'Some harassment mentions in reviews', 8);
  if (app.burstReviews) add('burst_reviews', 'Suspicious burst of 5-star reviews', 12);

  // Unregistered finance apps get a risk floor
  let finalScore = Math.max(0, Math.min(100, raw));
  if (gate === 'unauthorized' || gate === 'unverified') {
    finalScore = Math.max(70, finalScore);
  }

  return { ...app, gate, riskScore: finalScore, firedSignals: signals };
}
