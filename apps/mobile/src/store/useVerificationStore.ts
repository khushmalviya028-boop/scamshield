import { create } from 'zustand';
import { ScoreResult } from '../domain/entities/AppVerification';

interface VerificationStore {
  // Recent verifications (in-memory, persisted separately via AsyncStorage)
  recentVerifications: ScoreResult[];
  currentResult: ScoreResult | null;

  // Actions
  setCurrentResult: (result: ScoreResult) => void;
  addToRecent: (result: ScoreResult) => void;
  setRecentVerifications: (results: ScoreResult[]) => void;
  clearCurrent: () => void;
}

export const useVerificationStore = create<VerificationStore>((set) => ({
  recentVerifications: [],
  currentResult: null,

  setCurrentResult: (result) => set({ currentResult: result }),

  addToRecent: (result) =>
    set((state) => ({
      recentVerifications: [
        result,
        ...state.recentVerifications.filter((r) => r.appName !== result.appName),
      ].slice(0, 20),
    })),

  setRecentVerifications: (results) => set({ recentVerifications: results }),

  clearCurrent: () => set({ currentResult: null }),
}));
