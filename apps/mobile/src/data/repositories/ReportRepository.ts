import { IReportRepository, SubmitReportRequest } from '../../domain/repositories/IReportRepository';
import { apiClient } from '../api/apiClient';

export class ReportRepository implements IReportRepository {
  async submitReport(request: SubmitReportRequest): Promise<void> {
    await apiClient.post('/api/reports', request);
  }

  async getReportCount(packageId: string): Promise<number> {
    try {
      const res = await apiClient.get(`/api/reports/count/${packageId}`);
      return res.data?.count ?? 0;
    } catch {
      return 0;
    }
  }
}
