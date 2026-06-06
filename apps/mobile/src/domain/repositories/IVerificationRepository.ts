import { ScoreResult, VerifyRequest } from '../entities/AppVerification';

export interface IVerificationRepository {
  verify(request: VerifyRequest): Promise<ScoreResult>;
  getRecentVerifications(): Promise<ScoreResult[]>;
  saveVerification(result: ScoreResult): Promise<void>;
  clearHistory(): Promise<void>;
}
