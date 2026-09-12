import type { RuntimeAvailabilityConfig } from '@digvation/business-runtime';

/**
 * Projects granted role permissions through the tenant's resolved product,
 * capability, and foundation availability. Role grants remain authoritative in
 * Access Control; this projection is what business UI contributions may use.
 */
export function effectiveBusinessPermissions(
  granted: Iterable<string>,
  availability: RuntimeAvailabilityConfig,
): string[] {
  return [...new Set(granted)].filter((permission) =>
    permissionIsAvailable(permission, availability),
  );
}

function permissionIsAvailable(
  permission: string,
  availability: RuntimeAvailabilityConfig,
): boolean {
  const { products, capabilities } = availability.effectiveEntitlements;
  const foundations = availability.effectiveFoundations;

  if (
    permission.startsWith('sales:') ||
    permission.startsWith('payments:') ||
    permission.startsWith('fulfillment:')
  )
    return products.includes('POS');

  if (permission.startsWith('contributions:'))
    return products.includes('POS') && foundations.includes('WORKFORCE');

  if (
    permission.startsWith('catalog:') ||
    permission.startsWith('pricing:')
  )
    return foundations.includes('CATALOG');

  if (permission.startsWith('employees:'))
    return foundations.includes('WORKFORCE');

  if (permission.startsWith('attendance:'))
    return (
      foundations.includes('WORKFORCE') &&
      capabilities.includes('WORKFORCE_ATTENDANCE')
    );

  if (
    permission.startsWith('financial-accounts:') ||
    permission.startsWith('payment-routing:') ||
    permission.startsWith('cash:') ||
    permission.startsWith('expenses:') ||
    permission.startsWith('settlements:') ||
    permission.startsWith('reconciliations:')
  )
    return capabilities.includes('FINANCE_OPERATIONS');

  if (permission.startsWith('tax:'))
    return capabilities.includes('TAX_FISCAL');

  if (permission.startsWith('locations:'))
    return foundations.includes('ORGANIZATION_LOCATION');

  if (permission.startsWith('operational-access:'))
    return foundations.includes('OPERATIONAL_ACCESS');

  if (
    permission.startsWith('auth:') ||
    permission.startsWith('users:') ||
    permission.startsWith('roles:')
  )
    return foundations.includes('IDENTITY_ACCESS');

  return true;
}
