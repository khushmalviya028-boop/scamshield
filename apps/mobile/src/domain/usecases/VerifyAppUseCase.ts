// Pure business logic — orchestrates the verification flow
import { IVerificationRepository } from '../repositories/IVerificationRepository';
import { ScoreResult, VerifyRequest } from '../entities/AppVerification';

export class VerifyAppUseCase {
  constructor(private readonly repo: IVerificationRepository) {}

  async execute(request: VerifyRequest): Promise<ScoreResult> {
    if (!request.url && !request.packageId && !request.bundleId && !request.appName) {
      throw new Error(
        'At least one identifier (url, packageId, bundleId, or appName) is required.'
      );
    }
    const result = await this.repo.verify(request);
    await this.repo.saveVerification(result);
    return result;
  }
}
