import { useEffect } from 'react';
import { VerificationRepository } from '../data/repositories/VerificationRepository';
import { useVerificationStore } from '../store/useVerificationStore';

const repo = new VerificationRepository();

export function useRecentVerifications() {
  const { recentVerifications, setRecentVerifications } = useVerificationStore();

  useEffect(() => {
    repo.getRecentVerifications().then(setRecentVerifications);
  }, []);

  return recentVerifications;
}
