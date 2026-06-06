import { ScoreResult, VerifyRequest } from '../types';
import client from './client';
import { getMockResult as _getMockResult } from '../data/api/mockData';

export { getMockResult, getDemoResult } from '../data/api/mockData';

interface VerifyResponse {
  success: boolean;
  result?: ScoreResult;
  error?: string;
}

export async function verifyApp(request: VerifyRequest): Promise<ScoreResult> {
  const appName = request.appName || request.url || request.packageId || 'Unknown App';

  try {
    const response = await client.post<VerifyResponse>('/api/verify', request);
    const { success, result, error } = response.data;
    if (!success || !result) throw new Error(error ?? 'Verification failed');
    return result;
  } catch (error) {
    if (__DEV__) {
      console.warn('[ScamShield] verifyApp API call failed, using mock result');
    }
    return _getMockResult(appName);
  }
}
