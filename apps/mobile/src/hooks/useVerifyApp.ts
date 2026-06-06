import { useMutation } from '@tanstack/react-query';
import { VerifyRequest } from '../domain/entities/AppVerification';
import { VerificationRepository } from '../data/repositories/VerificationRepository';
import { VerifyAppUseCase } from '../domain/usecases/VerifyAppUseCase';
import { useVerificationStore } from '../store/useVerificationStore';

const repo = new VerificationRepository();
const useCase = new VerifyAppUseCase(repo);

export function useVerifyApp() {
  const { setCurrentResult, addToRecent } = useVerificationStore();

  return useMutation({
    mutationFn: (request: VerifyRequest) => useCase.execute(request),
    onSuccess: (result) => {
      setCurrentResult(result);
      addToRecent(result);
    },
  });
}
