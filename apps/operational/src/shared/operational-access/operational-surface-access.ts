import { canReadOperationalCustomers } from '../../features/customers/customer-access';

export type OperationalHomePath = '/sell' | '/expenses' | '/customers';

/**
 * Why a signed-in account cannot use Operational at all. The reasons are deliberately coarse: they
 * never name the missing permission or entitlement, only what the person can do next.
 *  - MODULE_NOT_ENABLED: the business has not enabled any module Operational runs.
 *  - NO_PERMITTED_MODULE: modules are enabled, but this account's role grants none of them.
 */
export type OperationalDenial = 'MODULE_NOT_ENABLED' | 'NO_PERMITTED_MODULE';

export interface OperationalSurfaceAccessInput {
  products: readonly string[];
  capabilities: readonly string[];
  foundations: readonly string[];
  permissions: readonly string[];
}

export function canAccessOperationalExpenses(
  permissions: readonly string[],
  hasFinanceOperations: boolean,
) {
  return (
    hasFinanceOperations &&
    (permissions.includes('expenses:read') ||
      permissions.includes('expenses:read-own') ||
      permissions.includes('expenses:create'))
  );
}

export interface OperationalSurfaceAccess {
  canSell: boolean;
  canAccessExpenses: boolean;
  canAccessCustomers: boolean;
  /** First module the account can open, or null when there is none. */
  home: OperationalHomePath | null;
  /** Set only when `home` is null. */
  denial: OperationalDenial | null;
}

/**
 * Single source of truth for which Operational modules an account may open. The sign-in boundary
 * and the router both use it, so they cannot disagree: selling requires `sales:create` (not merely
 * any `sales:*` permission), and `customers:read` alone never opens the POS.
 */
export function resolveOperationalSurfaceAccess(
  access: OperationalSurfaceAccessInput,
): OperationalSurfaceAccess {
  const hasPos = access.products.includes('POS');
  const hasFinance = access.capabilities.includes('FINANCE_OPERATIONS');
  const canSell = hasPos && access.permissions.includes('sales:create');
  const canAccessExpenses = canAccessOperationalExpenses(access.permissions, hasFinance);
  const canAccessCustomers = canReadOperationalCustomers(access.permissions, access.foundations);
  const home: OperationalHomePath | null = canSell
    ? '/sell'
    : canAccessExpenses
      ? '/expenses'
      : canAccessCustomers
        ? '/customers'
        : null;
  if (home) return { canSell, canAccessExpenses, canAccessCustomers, home, denial: null };

  const anyModuleEnabled =
    access.foundations.includes('OPERATIONAL_ACCESS') &&
    (hasPos || hasFinance || access.foundations.includes('CUSTOMER_IDENTITY'));
  return {
    canSell,
    canAccessExpenses,
    canAccessCustomers,
    home: null,
    denial: anyModuleEnabled ? 'NO_PERMITTED_MODULE' : 'MODULE_NOT_ENABLED',
  };
}
