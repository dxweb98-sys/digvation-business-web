import type { BackofficeSession } from '../../auth/auth-session';

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

/** Availability is entitlement/permission composition only, without tenant hide preferences. */
export function isReportAvailable(
  session: BackofficeSession | null,
  type: ReportType,
): boolean {
  if (!session) return false;
  if (!session.identity.permissions.includes(REPORT_PERMISSION[type])) return false;
  if (
    POS_REPORTS.has(type) &&
    !session.effectiveEntitlements.products.includes('POS')
  )
    return false;
  return true;
}

/**
 * UI composition only. Business preferences may hide an otherwise available
 * report, but never grant an unavailable report. Backend report guards remain
 * the final authority.
 */
export function canAccessReport(
  session: BackofficeSession | null,
  type: ReportType,
): boolean {
  if (!isReportAvailable(session, type)) return false;
  return !session!.businessConfiguration?.experience.hiddenReports.includes(type);
}

export function isDashboardWidgetAvailable(
  session: BackofficeSession | null,
  widget: DashboardWidget,
): boolean {
  return isReportAvailable(session, DASHBOARD_REPORT[widget]);
}

export function canShowDashboardWidget(
  session: BackofficeSession | null,
  widget: DashboardWidget,
): boolean {
  if (!isDashboardWidgetAvailable(session, widget)) return false;
  return !session!.businessConfiguration?.experience.hiddenDashboardWidgets.includes(
    widget,
  );
}
