import { describe, expect, it } from 'vitest';
import type { SessionAccess } from './auth.types';
import { canUseSessionFeature, hasSessionFeature } from './session-entitlement-access';

const access: SessionAccess = {
  products: ['POS'],
  capabilities: ['MEMBERSHIP', 'LOYALTY_POINTS', 'PROMOTIONS'],
  foundations: ['CUSTOMER_IDENTITY'],
  permissions: ['membership:read'],
  entitlements: {
    products: {
      POS: {
        enabled: true,
        features: { PROMOTIONS: true, MEMBERSHIP: { enabled: true, LOYALTY_POINTS: true } },
      },
    },
    modules: {
      FINANCE: { OPERATIONS: false, TAX_FISCAL: false },
      WORKFORCE: { ATTENDANCE: false },
      ANALYTICS: { BUSINESS: false },
    },
  },
};

describe('canonical session feature checks', () => {
  it('intersects feature and actor permission', () => {
    expect(canUseSessionFeature(access, 'MEMBERSHIP', ['membership:read'])).toBe(true);
    expect(canUseSessionFeature(access, 'MEMBERSHIP', ['membership:update'])).toBe(false);
  });

  it('fails closed when nested hierarchy disables a flat capability', () => {
    const disabled = {
      ...access,
      entitlements: {
        ...access.entitlements!,
        products: {
          POS: {
            ...access.entitlements!.products.POS,
            features: {
              ...access.entitlements!.products.POS.features,
              MEMBERSHIP: { enabled: false, LOYALTY_POINTS: false },
            },
          },
        },
      },
    };
    expect(hasSessionFeature(disabled, 'MEMBERSHIP')).toBe(false);
  });

  it('keeps the original flat entitlement contract during staged deployment', () => {
    const { entitlements: _unused, ...legacy } = access;
    expect(hasSessionFeature(legacy, 'MEMBERSHIP')).toBe(true);
    expect(hasSessionFeature({ ...legacy, capabilities: [] }, 'MEMBERSHIP')).toBe(false);
  });
});
