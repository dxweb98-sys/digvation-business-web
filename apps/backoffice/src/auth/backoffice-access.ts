import type { AuthSession } from '@digvation/business-auth';

export type BackofficeCapability =
  | 'dashboard'
  | 'catalog'
  | 'promotions'
  | 'employees'
  | 'memberships'
  | 'attendance'
  | 'finance'
  | 'expenses'
  | 'financialAccounts'
  | 'financialOperations'
  | 'reports'
  | 'transactions'
  | 'configuration'
  | 'accessControl'
  | 'activity';

export type BackofficeAction =
  | 'createRole'
  | 'updateRole'
  | 'manageRolePermissions'
  | 'viewUsers'
  | 'inviteUsers'
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
  | 'createPromotion'
  | 'updatePromotion'
  | 'createEmployee'
  | 'updateEmployee'
  | 'manageAttendance'
  | 'enrollMember'
  | 'manageMember'
  | 'viewLoyalty'
  | 'configureLoyalty'
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

export const BACKOFFICE_ACCESS_PERMISSION = 'backoffice:access';

interface PermissionRequirement {
  allOf?: readonly string[];
  anyOf?: readonly string[];
}

const capabilityPermissions: Record<BackofficeCapability, PermissionRequirement> = {
  dashboard: { allOf: ['auth:self'] },
  catalog: { allOf: ['catalog:read'] },
  promotions: { allOf: ['promotions:read'] },
  employees: { allOf: ['employees:read'] },
  memberships: { allOf: ['membership:read'] },
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
      'locations:read',
    ],
  },
  // History shows completed transactions in full, which Runtime grants only with sales:read-completed.
  transactions: { allOf: ['sales:read', 'sales:read-completed'] },
  configuration: { anyOf: ['business-profile:read', 'locations:read'] },
  accessControl: { allOf: ['roles:read'] },
  activity: { allOf: ['activity:read'] },
};

const actionPermissions: Record<BackofficeAction, readonly string[]> = {
  createRole: ['roles:create'],
  updateRole: ['roles:update'],
  manageRolePermissions: ['roles:permissions'],
  viewUsers: ['users:read'],
  inviteUsers: ['users:invite'],
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
  createPromotion: ['promotions:create'],
  updatePromotion: ['promotions:update'],
  createEmployee: ['employees:create'],
  updateEmployee: ['employees:update'],
  manageAttendance: ['attendance:manage'],
  enrollMember: ['membership:enroll'],
  manageMember: ['customers:manage', 'membership:update'],
  viewLoyalty: ['loyalty:read'],
  configureLoyalty: ['loyalty:configure'],
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
  session: AuthSession,
  capability: BackofficeCapability,
): boolean {
  if (!session.access.permissions.includes(BACKOFFICE_ACCESS_PERMISSION))
    return false;
  const requirement = capabilityPermissions[capability];
  const permissions = session.access.permissions;
  const hasAll = (requirement.allOf ?? []).every((permission) => permissions.includes(permission));
  const hasAny =
    !requirement.anyOf || requirement.anyOf.some((permission) => permissions.includes(permission));
  return hasAll && hasAny;
}

export function canPerformBackofficeAction(
  session: AuthSession,
  action: BackofficeAction,
): boolean {
  if (!session.access.permissions.includes(BACKOFFICE_ACCESS_PERMISSION))
    return false;
  return actionPermissions[action].every((permission) =>
    session.access.permissions.includes(permission),
  );
}
