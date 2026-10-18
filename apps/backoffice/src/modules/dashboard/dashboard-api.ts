import type { ApiClient } from '@digvation/business-api';

import type {
  DashboardDailySummary,
  DashboardDataset,
  DashboardFilterState,
  DashboardOperationalAccess,
  DashboardReportType,
} from './dashboard.types';

export class DashboardApi {
  constructor(private readonly api: ApiClient) {}

  operationalAccess(): Promise<DashboardOperationalAccess> {
    return this.api.get<DashboardOperationalAccess>('/api/v1/operational-access/context');
  }

  dailySummary(locationId: string): Promise<DashboardDailySummary> {
    const params = new URLSearchParams({ sellingLocationId: locationId });
    return this.api.get<DashboardDailySummary>(
      `/api/v1/reports/dashboard-summary?${params.toString()}`,
    );
  }

  report(
    type: DashboardReportType,
    filters: DashboardFilterState,
    pageSize = 100,
  ): Promise<DashboardDataset> {
    const params = new URLSearchParams({
      dateFrom: filters.from,
      dateTo: filters.to,
      page: '1',
      pageSize: String(pageSize),
      ...(filters.locationId ? { sellingLocationId: filters.locationId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });

    return this.api.get<DashboardDataset>(`/api/v1/reports/${type}?${params.toString()}`);
  }
}
