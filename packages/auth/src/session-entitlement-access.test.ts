import { describe, expect, it } from 'vitest';
import type { SessionAccess } from './auth.types';
import { canUseSessionFeature, hasSessionFeature } from './session-entitlement-access';

const access: SessionAccess = {
  products: ['POS'],
  capabilities: [
    'POS_PRODUCT_SALES',
    'POS_PRODUCT_COMMISSION',
    'MULTI_BRANCH',
    'EMPLOYEE_WORKFORCE',
    'MEMBERSHIP',
    'LOYALTY_POINTS',
    'PROMOTIONS',
  ],
  foundations: ['CATALOG', 'CUSTOMER_IDENTITY', 'WORKFORCE'],
  permissions: ['membership:read', 'commission:read', 'sales:read'],
  entitlements: {
    products: {
      POS: {
        enabled: true,
        selling: { PRODUCT: true, SERVICE: false },
        features: { PRODUCT_COMMISSION: true },
      },
    },
    modules: {
      ORGANIZATION: { MULTI_BRANCH: true },
      CATALOG: { enabled: true, PRODUCTS: true, SERVICES: false },
      CUSTOMER: {
        enabled: true,
        MEMBERSHIP: { enabled: true, LOYALTY_POINTS: true },
      },
      COMMERCIAL: { PROMOTIONS: true },
      EMPLOYEE: { WORKFORCE: true, ATTENDANCE: false },
      FINANCE: { OPERATIONS: false },
      TAX: false,
    },
  },
};

describe('domain entitlement selectors', () => {
  it('intersects entitled domain and actor permissions', () => {
    expect(canUseSessionFeature(access, 'MEMBERSHIP', ['membership:read'])).toBe(true);
    expect(canUseSessionFeature(access, 'MEMBERSHIP', ['membership:update'])).toBe(false);
    expect(canUseSessionFeature(access, 'POS_PRODUCT_COMMISSION', ['commission:read'])).toBe(true);
  });

  it('separates retail product selling and service selling', () => {
    expect(hasSessionFeature(access, 'POS_PRODUCT_SALES')).toBe(true);
    expect(hasSessionFeature(access, 'POS_SERVICE_SALES')).toBe(false);
  });

  it('denies a feature disabled in hierarchy, even if its flat key appears', () => {
    const disabled: SessionAccess = {
      ...access,
      entitlements: {
        ...access.entitlements!,
        modules: {
          ...access.entitlements!.modules,
          CUSTOMER: {
            ...access.entitlements!.modules.CUSTOMER,
            MEMBERSHIP: { enabled: false, LOYALTY_POINTS: false },
          },
        },
      },
    };
    expect(hasSessionFeature(disabled, 'MEMBERSHIP')).toBe(false);
  });

  it('honors independent Loyalty and Product Commission flags in modern sessions', () => {
    const independent: SessionAccess = {
      ...access,
      capabilities: ['POS_PRODUCT_COMMISSION', 'LOYALTY_POINTS'],
      entitlements: {
        ...access.entitlements!,
        products: {
          POS: {
            enabled: true,
            selling: { PRODUCT: false, SERVICE: false },
            features: { PRODUCT_COMMISSION: true },
          },
        },
        modules: {
          ...access.entitlements!.modules,
          CUSTOMER: {
            ...access.entitlements!.modules.CUSTOMER,
            MEMBERSHIP: { enabled: false, LOYALTY_POINTS: true },
          },
        },
      },
    };
    expect(hasSessionFeature(independent, 'POS_PRODUCT_SALES')).toBe(false);
    expect(hasSessionFeature(independent, 'POS_SERVICE_SALES')).toBe(false);
    expect(hasSessionFeature(independent, 'POS_PRODUCT_COMMISSION')).toBe(true);
    expect(hasSessionFeature(independent, 'LOYALTY_POINTS')).toBe(true);
    expect(hasSessionFeature(independent, 'MEMBERSHIP')).toBe(false);
  });

  it('controls multi-branch and Employee Workforce without coupling either to Attendance', () => {
    const independent: SessionAccess = {
      ...access,
      capabilities: ['POS_SERVICE_SALES', 'WORKFORCE_ATTENDANCE'],
      entitlements: {
        ...access.entitlements!,
        modules: {
          ...access.entitlements!.modules,
          ORGANIZATION: { MULTI_BRANCH: false },
          EMPLOYEE: { WORKFORCE: false, ATTENDANCE: true },
        },
      },
    };
    expect(hasSessionFeature(independent, 'MULTI_BRANCH')).toBe(false);
    expect(hasSessionFeature(independent, 'EMPLOYEE_WORKFORCE')).toBe(false);
    expect(hasSessionFeature(independent, 'WORKFORCE_ATTENDANCE')).toBe(true);
  });

  it('preserves the flat contract for the older Runtime', () => {
    const old: SessionAccess = {
      products: ['POS'],
      capabilities: ['MEMBERSHIP', 'PROMOTIONS'],
      foundations: [],
      permissions: ['membership:read'],
    };
    expect(hasSessionFeature(old, 'MEMBERSHIP')).toBe(true);
    expect(hasSessionFeature(old, 'POS_SERVICE_SALES')).toBe(true);
    expect(hasSessionFeature({ ...old, capabilities: [] }, 'PROMOTIONS')).toBe(false);
  });

  it('separates composition configuration from Service and Product direct selling', () => {
    const composition: SessionAccess = {
      ...access,
      capabilities: ['POS_SERVICE_SALES', 'CATALOG_SERVICE_COMPOSITION'],
      entitlements: {
        ...access.entitlements!,
        products: {
          POS: {
            enabled: true,
            selling: { PRODUCT: false, SERVICE: true },
            features: { PRODUCT_COMMISSION: false },
          },
        },
        modules: {
          ...access.entitlements!.modules,
          CATALOG: {
            enabled: true,
            PRODUCTS: false,
            SERVICES: true,
            SERVICE_COMPOSITION: true,
          },
        },
      },
    };
    expect(hasSessionFeature(composition, 'CATALOG_SERVICE_COMPOSITION')).toBe(true);
    expect(hasSessionFeature(composition, 'POS_PRODUCT_SALES')).toBe(false);
    const disabled: SessionAccess = {
      ...composition,
      capabilities: ['POS_SERVICE_SALES'],
      entitlements: {
        ...composition.entitlements!,
        modules: {
          ...composition.entitlements!.modules,
          CATALOG: {
            ...composition.entitlements!.modules.CATALOG,
            SERVICE_COMPOSITION: false,
          },
        },
      },
    };
    expect(hasSessionFeature(disabled, 'CATALOG_SERVICE_COMPOSITION')).toBe(false);
    const legacy: SessionAccess = {
      ...disabled,
      entitlements: {
        ...disabled.entitlements!,
        modules: {
          ...disabled.entitlements!.modules,
          CATALOG: { enabled: true, PRODUCTS: false, SERVICES: true },
        },
      },
    };
    expect(hasSessionFeature(legacy, 'CATALOG_SERVICE_COMPOSITION')).toBe(true);
  });

  it('does not require POS for cross-domain Membership', () => {
    const crossDomain: SessionAccess = {
      products: [],
      capabilities: ['MEMBERSHIP', 'LOYALTY_POINTS'],
      foundations: ['CUSTOMER_IDENTITY'],
      permissions: ['membership:read'],
    };
    expect(hasSessionFeature(crossDomain, 'MEMBERSHIP')).toBe(true);
  });
});
