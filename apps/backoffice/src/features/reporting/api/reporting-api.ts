import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../../shared/api/build-query-string';
import type { ReportType } from '../model/report-availability';

export type ReportValue = string | number | null;
export type ReportRow = Record<string, ReportValue>;

export interface ReportPoint {
  label: string;
  value: string;
  count?: number;
}

/** A component-usage breakdown entry: fixed/selected split and the services that used it. */
export interface ComponentUsagePoint extends ReportPoint {
  fixedQuantity?: string;
  selectedQuantity?: string;
  billedAmount?: string;
  services?: { label: string; quantity: string }[];
}

export interface ReportDataset {
  type: ReportType;
  summary: ReportRow;
  analytics: {
    trend: ReportPoint[];
    breakdown: ReportPoint[];
    breakdowns?: Record<string, ReportPoint[]>;
    ranking: ReportPoint[];
  };
  items: ReportRow[];
  total: number;
}

/** Period, location, filters, and search; the Runtime applies all of them server-side. */
export interface ReportQuery {
  dateFrom: string;
  dateTo: string;
  sellingLocationId?: string;
  [filter: string]: string | undefined;
}

export interface OperationalLocationContext {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
  locations: { id: string; code: string; name: string }[];
}

export interface ReferenceOption {
  id: string;
  code?: string;
  name?: string;
  displayName?: string;
}

export type ReferenceSource =
  'employees' | 'positions' | 'catalogItems' | 'categories' | 'accounts';

const REFERENCE_PATH: Record<ReferenceSource, string> = {
  employees: '/api/v1/employees',
  positions: '/api/v1/employees/positions',
  catalogItems: '/api/v1/catalog/items',
  categories: '/api/v1/catalog/categories',
  accounts: '/api/v1/financial-accounts',
};

export type ExportFormat = 'xlsx' | 'csv';
export type ReportLocale = 'id' | 'en';

/** One employee's contribution drill-down for the selected period and location. */
export interface EmployeeContributionDetail {
  employee: {
    id: string;
    code: string;
    displayName: string;
    /** The employee's CURRENT position and status, not the historical snapshot. */
    currentPositionName: string | null;
    currentStatus: string;
  };
  period: { dateFrom: string; dateTo: string; sellingLocationId: string | null };
  summary: {
    contributedTransactions: number;
    contributedLineItems: number;
    contributionRevenue: string;
    averageContributionPerTransaction: string;
  };
  trend: { label: string; value: string }[];
  services: {
    label: string;
    transactionCount: number;
    workItemCount: number;
    amount: string;
    share: string | null;
    baseAmount: string;
    additional: { label: string; amount: string }[];
  }[];
  records: {
    items: {
      saleId: string;
      saleNumber: string | null;
      occurredAt: string;
      sellingLocation: string;
      serviceName: string;
      serviceVariantName: string | null;
      source: 'BASE_SERVICE' | 'ADDITIONAL_ITEM';
      componentName: string | null;
      componentVariantName: string | null;
      amount: string;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export class ReportingApi {
  constructor(
    private readonly client: ApiClient,
    private readonly apiBaseUrl: string,
    private readonly accessToken: () => Promise<string | null>,
  ) {}

  dataset(type: ReportType, query: ReportQuery, page: { page: number; pageSize: number }) {
    return this.client.get<ReportDataset>(
      `/api/v1/reports/${type}?${buildQueryString({ ...query, ...page })}`,
    );
  }

  employeeDetail(
    employeeId: string,
    query: Pick<ReportQuery, 'dateFrom' | 'dateTo' | 'sellingLocationId'>,
    page: { page: number; pageSize: number },
  ) {
    return this.client.get<EmployeeContributionDetail>(
      `/api/v1/reports/employee-performance/employees/${encodeURIComponent(employeeId)}?${buildQueryString({ ...query, ...page })}`,
    );
  }

  locationContext() {
    return this.client.get<OperationalLocationContext>('/api/v1/operational-access/context');
  }

  references(source: ReferenceSource) {
    return this.client.get<{ items: ReferenceOption[] }>(
      `${REFERENCE_PATH[source]}?${buildQueryString({ limit: 100, offset: 0 })}`,
    );
  }

  /**
   * The whole filtered dataset (not the visible page), presented by the Runtime in the active
   * Backoffice language.
   */
  async export(
    type: ReportType,
    format: ExportFormat,
    query: ReportQuery,
    locale: ReportLocale,
  ): Promise<Blob> {
    const token = await this.accessToken();
    const response = await fetch(
      `${this.apiBaseUrl}/api/v1/reports/${type}/export.${format}?${buildQueryString({ ...query, locale })}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string };
        code?: string;
      } | null;
      throw new Error(body?.error?.code ?? body?.code ?? 'REPORT_EXPORT_FAILED');
    }
    return response.blob();
  }
}
