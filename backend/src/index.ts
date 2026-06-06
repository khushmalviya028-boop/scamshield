import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { ScoreResult, RiskBand, RBIGate } from '../../engine/src/types';
import { logger } from './lib/logger';
import { validate } from './middleware/validate';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { VerifyRequestSchema, ReportSchema } from './lib/schemas';
import verifyRouter from './routes/verify';
import reportsRouter from './routes/reports';

const app = express();
const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3001;

// Security headers
app.use(helmet());

// Gzip responses
app.use(compression());

// CORS
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));

// Body parsing with size limit
app.use(express.json({ limit: '10kb' }));

// HTTP request logging
app.use(morgan('dev', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// Global API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  message: { success: false, error: 'Too many requests' },
});
app.use('/api', apiLimiter);

// Stricter rate limiter on verify
const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { success: false, error: 'Too many verification requests' },
});

// Routes
app.use('/api/verify', verifyLimiter, validate(VerifyRequestSchema), verifyRouter);
app.use('/api/reports', reportsRouter);

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Demo scenario helpers
function makeDemoResult(
  appName: string,
  packageId: string,
  score: number,
  band: RiskBand,
  gate: RBIGate,
  gateBanner: string,
  gateDetails: string,
  signalIds: string[],
  recommendedAction: string,
): ScoreResult {
  const SIGNAL_DETAILS: Record<string, { name: string; description: string; icon: string; points: number; severity: 'critical' | 'high' | 'medium' | 'low' }> = {
    rbi_authorized: { name: 'Registered in RBI DLA directory', description: "Found in RBI's Digital Lending App directory.", icon: '✅', points: -5, severity: 'low' },
    rbi_unauthorized: { name: 'Fails RBI registration check', description: 'No link to any RBI-regulated entity found.', icon: '🚫', points: 55, severity: 'critical' },
    contacts_sms_loan: { name: 'Contacts/SMS access on loan app', description: "Legitimate lenders don't need your contact list.", icon: '📋', points: 30, severity: 'critical' },
    camera_photo_loan: { name: 'Camera/Photos access on loan app', description: 'Camera access on a lending app is a precursor to blackmail.', icon: '📷', points: 10, severity: 'high' },
    burst_reviews: { name: 'Suspicious review pattern', description: 'Burst of near-identical 5-star reviews detected.', icon: '⭐', points: 12, severity: 'medium' },
    no_privacy_policy: { name: 'No privacy policy', description: 'This app has no privacy policy.', icon: '📄', points: 8, severity: 'medium' },
    new_developer_account: { name: 'Brand-new developer account', description: 'Developer account less than 30 days old.', icon: '👤', points: 12, severity: 'medium' },
    community_reports_some: { name: 'Several ScamShield reports', description: '5 or more ScamShield users have flagged this app.', icon: '🚩', points: 10, severity: 'high' },
  };

  return {
    appName,
    packageId,
    score,
    band,
    verdictLabel: band === 'safe' ? 'Likely Safe' : band === 'caution' ? 'Exercise Caution' : 'High Risk',
    gate,
    gateBanner,
    gateDetails,
    firedSignals: signalIds.map((id) => {
      const def = SIGNAL_DETAILS[id];
      return def ? { id, ...def, fired: true } : { id, name: id, description: '', icon: '⚠️', points: 0, severity: 'low' as const, fired: true };
    }),
    recommendedAction,
  };
}

const DEMO_SCENARIOS: Record<string, ScoreResult> = {
  safe: makeDemoResult(
    'HDFC Bank Mobile Banking',
    'com.hdfc.bank.mobilebanking',
    15,
    'safe',
    'authorized',
    'PASSES RBI REGISTRATION GATE',
    "Listed in RBI's Digital Lending App directory — authorisation, not conduct.",
    ['rbi_authorized'],
    'This app shows no major red flags. Exercise normal caution — never share passwords or OTPs with any app.',
  ),
  caution: makeDemoResult(
    'CashCow - Instant Loans',
    'com.cashcow.loans',
    45,
    'caution',
    'unverified',
    'NOT ON THE RBI LIST',
    'This lending app could not be verified in the RBI DLA directory. Do not share IDs or contacts until confirmed.',
    ['burst_reviews', 'no_privacy_policy', 'community_reports_some'],
    "Exercise caution. Do not share ID documents, contact list, or photos until you independently verify this app. Check RBI's website or contact your bank directly.",
  ),
  'high-risk': makeDemoResult(
    'QuickRupee - Fast Loan',
    'com.quickrupee.fastloan',
    92,
    'high-risk',
    'unauthorized',
    'FAILS RBI REGISTRATION GATE',
    'No link to any RBI-regulated entity found. This app is operating without regulatory authorisation.',
    ['rbi_unauthorized', 'contacts_sms_loan', 'camera_photo_loan', 'burst_reviews', 'new_developer_account'],
    'DO NOT proceed. Do not open, login, or share any information with this app. If already installed, uninstall immediately. If you have been scammed, call the National Cyber Crime Helpline 1930 or file a complaint at cybercrime.gov.in.',
  ),
};

// GET /api/demo/:scenario
app.get('/api/demo/:scenario', (req, res) => {
  const { scenario } = req.params;
  const result = DEMO_SCENARIOS[scenario];
  if (!result) {
    return res.status(404).json({
      success: false,
      error: `Unknown demo scenario "${scenario}". Valid options: safe, caution, high-risk`,
    });
  }
  return res.json({ success: true, result });
});

// 404 handler — must come after all routes
app.use(notFoundHandler);

// Error handler — must be last (4 args)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

// Start
app.listen(PORT, () => {
  logger.info(`ScamShield backend running on port ${PORT}`);
  logger.info(
    `Update API_URL in apps/mobile/src/config.ts to your local IP (e.g. http://<your-ip>:${PORT})`,
  );
});

export default app;
