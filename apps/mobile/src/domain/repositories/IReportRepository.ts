export type ReportType = 'scam' | 'harassment' | 'fake' | 'data-theft' | 'other';

export interface SubmitReportRequest {
  appName: string;
  packageId?: string;
  reportType: ReportType;
  description?: string;
}

export interface IReportRepository {
  submitReport(request: SubmitReportRequest): Promise<void>;
  getReportCount(packageId: string): Promise<number>;
}
