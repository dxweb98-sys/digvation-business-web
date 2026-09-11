export type DashboardReportType =
  | 'business-performance'
  | 'transactions'
  | 'catalog-performance'
  | 'employee-performance';

export type DashboardRow = Record<string, string | number | null>;

export interface DashboardAnalyticsPoint {
  label: string;
  value: string;
  count?: number;
}

export interface DashboardDataset {
  summary: DashboardRow;
  analytics: {
    trend: DashboardAnalyticsPoint[];
    breakdown: DashboardAnalyticsPoint[];
    breakdowns?: Record<string, DashboardAnalyticsPoint[]>;
    ranking: DashboardAnalyticsPoint[];
  };
  items: DashboardRow[];
  total: number;
}

export interface DashboardLocationOption {
  id: string;
  code: string;
  name?: string;
  displayName?: string;
}

export interface DashboardOperationalAccess {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
  locations: DashboardLocationOption[];
}

export interface DashboardFilterState {
  from: string;
  to: string;
  locationId: string;
}

export type DashboardWidgetId =
  | 'salesTrend'
  | 'paymentMix'
  | 'topItems'
  | 'topEmployees'
  | 'locationPerformance'
  | 'businessInsight';
