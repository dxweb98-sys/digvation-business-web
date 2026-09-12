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

/**
 * UI composition only. Runtime effective permissions have already intersected
 * RBAC grants with capability/foundation availability. Reports that project POS
 * facts additionally require the POS product itself. Backend report guards remain
 * the final authority.
 */
export function canAccessReport(session: BackofficeSession | null, type: ReportType): boolean {
  if (!session) return false;
  if (!session.identity.permissions.includes(REPORT_PERMISSION[type])) return false;
  if (POS_REPORTS.has(type) && !session.effectiveEntitlements.products.includes('POS')) return false;
  return true;
}
