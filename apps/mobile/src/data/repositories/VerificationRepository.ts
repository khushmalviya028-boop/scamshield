import AsyncStorage from '@react-native-async-storage/async-storage';
import { IVerificationRepository } from '../../domain/repositories/IVerificationRepository';
import {
  ScoreResult,
  ScoreResultSchema,
  VerifyRequest,
} from '../../domain/entities/AppVerification';
import { apiClient } from '../api/apiClient';
import { getMockResult } from '../api/mockData';

const HISTORY_KEY = '@scamshield/verifications';
const MAX_HISTORY = 20;

export class VerificationRepository implements IVerificationRepository {
  async verify(request: VerifyRequest): Promise<ScoreResult> {
    try {
      const response = await apiClient.post('/api/verify', request);
      // Validate response shape with Zod — never trust external data
      return ScoreResultSchema.parse(response.data);
    } catch {
      // Graceful fallback to mock data when offline
      return getMockResult(request.appName ?? request.url ?? 'Unknown App');
    }
  }

  async getRecentVerifications(): Promise<ScoreResult[]> {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveVerification(result: ScoreResult): Promise<void> {
    try {
      const existing = await this.getRecentVerifications();
      const deduped = existing.filter((r) => r.appName !== result.appName);
      const updated = [result, ...deduped].slice(0, MAX_HISTORY);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Non-critical — don't crash the app
    }
  }

  async clearHistory(): Promise<void> {
    await AsyncStorage.removeItem(HISTORY_KEY);
  }
}
