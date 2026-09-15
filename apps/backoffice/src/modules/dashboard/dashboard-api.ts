import type { ApiClient } from '@digvation/business-api';

import type {
  DashboardDataset,
  DashboardFilterState,
  DashboardOperationalAccess,
  DashboardReportType,
} from './dashboard.types';

export class DashboardApi {
  constructor(private readonly api: ApiClient) {}

  operationalAccess(): Promise<DashboardOperationalAccess> {
    return this.api.get<DashboardOperationalAccess>(
      '/api/v1/operational-access/context',
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
      ...(filters.locationId
        ? { sellingLocationId: filters.locationId }
        : {}),
    });

    return this.api.get<DashboardDataset>(
      `/api/v1/reports/${type}?${params.toString()}`,
    );
  }
}
