import { hasSessionFeature, type AuthSession } from '@digvation/business-auth';

export type ReportType =
  | 'business-performance'
  | 'transactions'
  | 'catalog-performance'
  | 'component-usage'
  | 'product-commission'
  | 'employee-performance'
  | 'attendance'
  | 'payments'
  | 'expenses'
  | 'cash'
  | 'tax'
  | 'locations';

export type DashboardWidget =
  'TOP_ITEMS' | 'PAYMENT_MIX' | 'RECENT_TRANSACTIONS' | 'TOP_EMPLOYEES' | 'BUSINESS_INSIGHT';

const REPORT_PERMISSION: Record<ReportType, string> = {
  'business-performance': 'sales:read',
  transactions: 'sales:read',
  'catalog-performance': 'catalog:read',
  // Historical component usage is a Sale fact and follows the transaction reports' access.
  'component-usage': 'sales:read',
  // Compensation attribution, not Product price or revenue: it has its own permission.
  'product-commission': 'commission:read',
  'employee-performance': 'employees:read',
  attendance: 'attendance:read',
  payments: 'payments:read',
  expenses: 'expenses:read',
  cash: 'cash:read',
  // Captured sale tax is Tax visibility; tax:read is only effective with TAX_FISCAL.
  tax: 'tax:read',
  locations: 'locations:read',
};

const POS_REPORTS = new Set<ReportType>([
  'business-performance',
  'transactions',
  'catalog-performance',
  'component-usage',
  'product-commission',
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
  // Only the current catalog: dormant projections (e.g. settlements) have no entry here.
  const permission = REPORT_PERMISSION[type] as string | undefined;
  if (!session || !permission) return false;
  if (!session.access.permissions.includes(permission)) return false;
  if (POS_REPORTS.has(type) && !hasSessionFeature(session.access, 'POS')) return false;
  // Older Runtimes already filtered the flat permission projection. Domain
  // hierarchy checks apply when the newer projection is available.
  const hasDomainHierarchy = Boolean(
    session.access.entitlements && 'CUSTOMER' in session.access.entitlements.modules,
  );
  if (!hasDomainHierarchy) return true;
  if (type === 'employee-performance' && !session.access.foundations.includes('WORKFORCE'))
    return false;
  // A commission report must never appear for a client without the delivered
  // Product-sales commission capability (Attendance is unrelated).
  if (type === 'product-commission' && !hasSessionFeature(session.access, 'POS_PRODUCT_COMMISSION'))
    return false;
  if (type === 'attendance' && !hasSessionFeature(session.access, 'WORKFORCE_ATTENDANCE'))
    return false;
  if (type === 'tax' && !hasSessionFeature(session.access, 'TAX_FISCAL')) return false;
  if (
    (type === 'expenses' || type === 'cash') &&
    !hasSessionFeature(session.access, 'FINANCE_OPERATIONS')
  )
    return false;
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
  if (!isReportAvailable(session, DASHBOARD_REPORT[widget])) return false;
  // Business Insights is optional; ordinary sales and finance projections
  // remain visible whenever their own domain/permission is available.
  if (widget === 'BUSINESS_INSIGHT') {
    if (!session?.access.entitlements) return true;
    return hasSessionFeature(session.access, 'BUSINESS_ANALYTICS');
  }
  return true;
}

/** All dashboard contributions for enabled features are shown. */
export function canShowDashboardWidget(
  session: AuthSession | null,
  widget: DashboardWidget,
): boolean {
  return isDashboardWidgetAvailable(session, widget);
}
