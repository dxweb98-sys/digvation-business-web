import type { SessionAccess } from './auth.types';

/**
 * Session entitlements are read-only projections; Runtime is the only authority.
 * Keep the flat keys for staged rollouts, and intersect them with the new
 * hierarchy when it is available. Never infer a grant from a screen or role.
 */
export type SessionFeature =
  | 'POS'
  | 'POS_PRODUCT_SALES'
  | 'POS_SERVICE_SALES'
  | 'POS_PRODUCT_COMMISSION'
  | 'PROMOTIONS'
  | 'MEMBERSHIP'
  | 'LOYALTY_POINTS'
  | 'FINANCE_OPERATIONS'
  | 'TAX_FISCAL'
  | 'WORKFORCE_ATTENDANCE'
  | 'BUSINESS_ANALYTICS';

/** A legacy Runtime can still return its old hierarchy during rolling updates. */
export function hasSessionFeature(access: SessionAccess, feature: SessionFeature): boolean {
  const pos = access.products.includes('POS');
  if (feature === 'POS') return pos && (access.entitlements?.products.POS.enabled ?? true);
  // Old POS grants both selling kinds and Product commission by default.
  const hasExplicitSelling =
    access.capabilities.includes('POS_PRODUCT_SALES') ||
    access.capabilities.includes('POS_SERVICE_SALES');
  const legacyPosFeature =
    pos &&
    !hasExplicitSelling &&
    (feature === 'POS_PRODUCT_SALES' ||
      feature === 'POS_SERVICE_SALES' ||
      feature === 'POS_PRODUCT_COMMISSION');
  if (!access.capabilities.includes(feature) && !legacyPosFeature) return false;

  // The flat keys are authoritative for the session; hierarchy is a projected
  // presentation. If the new structure is absent, preserve legacy behavior.
  const h = access.entitlements;
  if (!h || !('CUSTOMER' in h.modules)) return true;
  switch (feature) {
    case 'POS_PRODUCT_SALES':
      return h.products.POS.enabled && h.products.POS.selling.PRODUCT;
    case 'POS_SERVICE_SALES':
      return h.products.POS.enabled && h.products.POS.selling.SERVICE;
    case 'POS_PRODUCT_COMMISSION':
      return h.products.POS.enabled && h.products.POS.features.PRODUCT_COMMISSION;
    case 'PROMOTIONS':
      return h.modules.COMMERCIAL.PROMOTIONS;
    case 'MEMBERSHIP':
      return h.modules.CUSTOMER.MEMBERSHIP.enabled;
    case 'LOYALTY_POINTS':
      return h.modules.CUSTOMER.MEMBERSHIP.enabled &&
        h.modules.CUSTOMER.MEMBERSHIP.LOYALTY_POINTS;
    case 'FINANCE_OPERATIONS':
      return h.modules.FINANCE.OPERATIONS;
    case 'TAX_FISCAL':
      return h.modules.FISCAL.TAX;
    case 'WORKFORCE_ATTENDANCE':
      return h.modules.WORKFORCE.ATTENDANCE;
    case 'BUSINESS_ANALYTICS':
      return h.modules.ANALYTICS.BUSINESS_INSIGHTS;
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
