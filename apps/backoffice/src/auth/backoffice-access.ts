import type { BackofficeSession } from './auth-session';

export type BackofficeCapability =
  | 'dashboard'
  | 'catalog'
  | 'employees'
  | 'attendance'
  | 'finance'
  | 'expenses'
  | 'financialAccounts'
  | 'financialOperations'
  | 'reports'
  | 'transactions'
  | 'configuration'
  | 'tax'
  | 'accessControl';

export type BackofficeAction =
  | 'createRole'
  | 'updateRole'
  | 'manageRolePermissions'
  | 'viewUsers'
  | 'manageUserRoles'
  | 'viewOperationalAccess'
  | 'manageOperationalAccess'
  | 'viewBusinessProfile'
  | 'updateBusinessProfile'
  | 'viewSellingLocations'
  | 'createSellingLocation'
  | 'updateSellingLocation'
  | 'viewCatalog'
  | 'createCatalog'
  | 'updateCatalog'
  | 'viewPricing'
  | 'createPricing'
  | 'cancelPricing'
  | 'viewTax'
  | 'createTax'
  | 'updateTax'
  | 'cancelTax'
  | 'createEmployee'
  | 'updateEmployee'
  | 'manageAttendance'
  | 'createFinancialAccount'
  | 'updateFinancialAccount'
  | 'updatePaymentRouting'
  | 'moveCash'
  | 'createExpense'
  | 'updateExpense'
  | 'approveExpense'
  | 'rejectExpense'
  | 'createSettlement'
  | 'updateSettlement'
  | 'createReconciliation'
  | 'updateReconciliation';

interface PermissionRequirement {
  allOf?: readonly string[];
  anyOf?: readonly string[];
}

const capabilityPermissions: Record<BackofficeCapability, PermissionRequirement> = {
  dashboard: { allOf: ['auth:self'] },
  catalog: { allOf: ['catalog:read'] },
  employees: { allOf: ['employees:read'] },
  attendance: { allOf: ['attendance:read'] },
  finance: { allOf: ['payments:read'] },
  expenses: { allOf: ['expenses:read'] },
  financialAccounts: {
    allOf: ['financial-accounts:read', 'payment-routing:read'],
  },
  financialOperations: {
    allOf: ['cash:read', 'settlements:read', 'reconciliations:read'],
  },
  reports: {
    anyOf: [
      'sales:read',
      'payments:read',
      'catalog:read',
      'employees:read',
      'attendance:read',
      'expenses:read',
      'cash:read',
      'settlements:read',
      'reconciliations:read',
      'tax:read',
      'locations:read',
    ],
  },
  transactions: { allOf: ['sales:read'] },
  configuration: { anyOf: ['business-profile:read', 'locations:read'] },
  tax: { allOf: ['tax:read'] },
  accessControl: { allOf: ['roles:read'] },
};

const actionPermissions: Record<BackofficeAction, readonly string[]> = {
  createRole: ['roles:create'],
  updateRole: ['roles:update'],
  manageRolePermissions: ['roles:permissions'],
  viewUsers: ['users:read'],
  manageUserRoles: ['users:roles'],
  viewOperationalAccess: ['operational-access:read'],
  manageOperationalAccess: ['operational-access:update'],
  viewBusinessProfile: ['business-profile:read'],
  updateBusinessProfile: ['business-profile:update'],
  viewSellingLocations: ['locations:read'],
  createSellingLocation: ['locations:create'],
  updateSellingLocation: ['locations:update'],
  viewCatalog: ['catalog:read'],
  createCatalog: ['catalog:create'],
  updateCatalog: ['catalog:update'],
  viewPricing: ['pricing:read'],
  createPricing: ['pricing:create'],
  cancelPricing: ['pricing:cancel'],
  viewTax: ['tax:read'],
  createTax: ['tax:create'],
  updateTax: ['tax:update'],
  cancelTax: ['tax:cancel'],
  createEmployee: ['employees:create'],
  updateEmployee: ['employees:update'],
  manageAttendance: ['attendance:manage'],
  createFinancialAccount: ['financial-accounts:create'],
  updateFinancialAccount: ['financial-accounts:update'],
  updatePaymentRouting: ['payment-routing:update'],
  moveCash: ['cash:move'],
  createExpense: ['expenses:create'],
  updateExpense: ['expenses:update'],
  approveExpense: ['expenses:approve'],
  rejectExpense: ['expenses:reject'],
  createSettlement: ['settlements:create'],
  updateSettlement: ['settlements:update'],
  createReconciliation: ['reconciliations:create'],
  updateReconciliation: ['reconciliations:update'],
};

export function canAccessBackoffice(
  session: BackofficeSession,
  capability: BackofficeCapability,
): boolean {
  const requirement = capabilityPermissions[capability];
  const permissions = session.identity.permissions;
  const hasAll = (requirement.allOf ?? []).every((permission) =>
    permissions.includes(permission),
  );
  const hasAny =
    !requirement.anyOf ||
    requirement.anyOf.some((permission) => permissions.includes(permission));
  return hasAll && hasAny;
}

export function canPerformBackofficeAction(
  session: BackofficeSession,
  action: BackofficeAction,
): boolean {
  return actionPermissions[action].every((permission) =>
    session.identity.permissions.includes(permission),
  );
}
