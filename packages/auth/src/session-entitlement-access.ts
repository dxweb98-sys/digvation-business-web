import type { SessionAccess } from './auth.types';

/** Checks the authenticated Runtime context, never a client-side entitlement source.
 * Flat capabilities remain required and are the fallback for older deployments.
 */
export type SessionFeature =
  | 'POS'
  | 'PROMOTIONS'
  | 'MEMBERSHIP'
  | 'LOYALTY_POINTS'
  | 'FINANCE_OPERATIONS'
  | 'TAX_FISCAL'
  | 'WORKFORCE_ATTENDANCE'
  | 'BUSINESS_ANALYTICS';

export function hasSessionFeature(access: SessionAccess, feature: SessionFeature): boolean {
  const hierarchy = access.entitlements;
  if (feature === 'POS')
    return access.products.includes('POS') && (hierarchy?.products.POS.enabled ?? true);
  if (!access.capabilities.includes(feature)) return false;
  if (!hierarchy) return true;
  switch (feature) {
    case 'PROMOTIONS':
      return hierarchy.products.POS.enabled && hierarchy.products.POS.features.PROMOTIONS;
    case 'MEMBERSHIP':
      return hierarchy.products.POS.enabled && hierarchy.products.POS.features.MEMBERSHIP.enabled;
    case 'LOYALTY_POINTS':
      return (
        hierarchy.products.POS.enabled &&
        hierarchy.products.POS.features.MEMBERSHIP.enabled &&
        hierarchy.products.POS.features.MEMBERSHIP.LOYALTY_POINTS
      );
    case 'FINANCE_OPERATIONS':
      return hierarchy.modules.FINANCE.OPERATIONS;
    case 'TAX_FISCAL':
      return hierarchy.modules.FINANCE.TAX_FISCAL;
    case 'WORKFORCE_ATTENDANCE':
      return hierarchy.modules.WORKFORCE.ATTENDANCE;
    case 'BUSINESS_ANALYTICS':
      return hierarchy.modules.ANALYTICS.BUSINESS;
  }
}

export function canUseSessionFeature(
  access: SessionAccess,
  feature: SessionFeature,
  requiredPermissions: readonly string[],
): boolean {
  return (
    hasSessionFeature(access, feature) &&
    requiredPermissions.every((permission) => access.permissions.includes(permission))
  );
}
