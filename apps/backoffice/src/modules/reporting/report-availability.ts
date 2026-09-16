import type { AuthSession } from '@digvation/business-auth';

export type ReportType =
  | 'business-performance'
  | 'transactions'
  | 'catalog-performance'
  | 'employee-performance'
  | 'attendance'
  | 'payments'
  | 'expenses'
  | 'cash'
  | 'settlements'
  | 'reconciliations'
  | 'tax'
  | 'locations';

export type DashboardWidget =
  | 'TOP_ITEMS'
  | 'PAYMENT_MIX'
  | 'RECENT_TRANSACTIONS'
  | 'TOP_EMPLOYEES'
  | 'BUSINESS_INSIGHT';

const REPORT_PERMISSION: Record<ReportType, string> = {
  'business-performance': 'sales:read',
  transactions: 'sales:read',
  'catalog-performance': 'catalog:read',
  'employee-performance': 'employees:read',
  attendance: 'attendance:read',
  payments: 'payments:read',
  expenses: 'expenses:read',
  cash: 'cash:read',
  settlements: 'settlements:read',
  reconciliations: 'reconciliations:read',
  tax: 'tax:read',
  locations: 'locations:read',
};

const POS_REPORTS = new Set<ReportType>([
  'business-performance',
  'transactions',
  'catalog-performance',
  'employee-performance',
  'payments',
  'tax',
  'locations',
]);

const DASHBOARD_REPORT: Record<DashboardWidget, ReportType> = {
  TOP_ITEMS: 'catalog-performance',
  PAYMENT_MIX: 'payments',
  RECENT_TRANSACTIONS: 'transactions',
  TOP_EMPLOYEES: 'employee-performance',
  BUSINESS_INSIGHT: 'business-performance',
};

/**
 * Report visibility is derived from the effective authenticated session.
 * Runtime has already intersected RBAC grants with product, capability, and
 * foundation availability before projecting access.permissions.
 */
export function isReportAvailable(session: AuthSession | null, type: ReportType): boolean {
  if (!session) return false;
  if (!session.access.permissions.includes(REPORT_PERMISSION[type])) return false;
  if (POS_REPORTS.has(type) && !session.access.products.includes('POS')) return false;
  return true;
}

/** Compatibility name used by report routes and selectors. */
export function canAccessReport(session: AuthSession | null, type: ReportType): boolean {
  return isReportAvailable(session, type);
}

export function isDashboardWidgetAvailable(
  session: AuthSession | null,
  widget: DashboardWidget,
): boolean {
  return isReportAvailable(session, DASHBOARD_REPORT[widget]);
}

/** All dashboard contributions for enabled features are shown. */
export function canShowDashboardWidget(
  session: AuthSession | null,
  widget: DashboardWidget,
): boolean {
  return isDashboardWidgetAvailable(session, widget);
}
