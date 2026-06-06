import client from './client';

interface ReportData {
  appName: string;
  packageId?: string;
  reportType: string;
  description?: string;
}

export async function submitReport(data: ReportData): Promise<void> {
  try {
    await client.post('/api/reports', data);
  } catch (error) {
    if (__DEV__) {
      console.warn('[ScamShield] submitReport failed (likely offline), treating as success');
    }
    // In dev/offline mode, simulate success so the UI flow works
  }
}

export async function getReportCount(packageId: string): Promise<number> {
  try {
    const response = await client.get<{ count: number }>(`/api/reports/count/${packageId}`);
    return response.data.count ?? 0;
  } catch {
    return 0;
  }
}
