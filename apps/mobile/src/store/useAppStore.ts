import { create } from 'zustand';

interface AppStore {
  isOnboardingComplete: boolean;
  setOnboardingComplete: (val: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isOnboardingComplete: false,
  setOnboardingComplete: (val) => set({ isOnboardingComplete: val }),
}));
