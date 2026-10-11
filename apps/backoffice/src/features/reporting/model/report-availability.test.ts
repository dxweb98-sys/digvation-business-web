import type { AuthSession } from '@digvation/business-auth';
import { describe, expect, it } from 'vitest';

import { canAccessReport, canShowDashboardWidget } from './report-availability';

function session(
  input: {
    permissions?: string[];
    products?: Array<'POS'>;
    capabilities?: string[];
    foundations?: string[];
  } = {},
): AuthSession {
  return {
    identity: {
      userId: 'user-1',
      displayName: 'Test User',
      username: 'test-user',
      roles: [],
    },
    business: {
      tenantId: 'tenant-1',
      name: 'Test Business',
      currency: 'IDR',
    },
    access: {
      products: input.products ?? [],
      capabilities: input.capabilities ?? [],
      foundations: input.foundations ?? ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY'],
      permissions: input.permissions ?? [],
    },
    preferences: {
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
    },
    deployment: { profile: 'SHARED' },
    contextVersion: 'test-context',
  };
}

describe('Backoffice report composition', () => {
  it('requires POS for reports that project POS facts', () => {
    expect(
      canAccessReport(session({ permissions: ['employees:read'] }), 'employee-performance'),
    ).toBe(false);
    expect(
      canAccessReport(
        session({ permissions: ['employees:read'], products: ['POS'] }),
        'employee-performance',
      ),
    ).toBe(true);
  });

  it('uses effective permissions for capability/foundation reports', () => {
    expect(canAccessReport(session({ permissions: ['attendance:read'] }), 'attendance')).toBe(true);
    expect(canAccessReport(session({ permissions: [] }), 'attendance')).toBe(false);
    expect(canAccessReport(session({ permissions: ['expenses:read'] }), 'expenses')).toBe(true);
  });

  it('gives component usage the transaction reports access: sales:read on a POS installation', () => {
    expect(canAccessReport(session({ permissions: ['sales:read'] }), 'component-usage')).toBe(
      false,
    );
    expect(
      canAccessReport(
        session({ permissions: ['sales:read'], products: ['POS'] }),
        'component-usage',
      ),
    ).toBe(true);
    expect(
      canAccessReport(
        session({ permissions: ['catalog:read', 'payments:read'], products: ['POS'] }),
        'component-usage',
      ),
    ).toBe(false);
  });

  it('keeps tax reports POS-scoped after TAX_FISCAL has made tax:read effective', () => {
    expect(canAccessReport(session({ permissions: ['tax:read'] }), 'tax')).toBe(false);
    expect(canAccessReport(session({ permissions: ['tax:read'], products: ['POS'] }), 'tax')).toBe(
      true,
    );
  });
});

describe('Current report catalog availability', () => {
  it('never offers the dormant settlement or reconciliation projections', () => {
    const everything = session({
      permissions: ['settlements:read', 'reconciliations:read'],
      products: ['POS'],
    });
    expect(canAccessReport(everything, 'settlements' as never)).toBe(false);
    expect(canAccessReport(everything, 'reconciliations' as never)).toBe(false);
  });

  it('shows the tax report with Tax visibility, not with Sale visibility', () => {
    expect(
      canAccessReport(session({ permissions: ['sales:read'], products: ['POS'] }), 'tax'),
    ).toBe(false);
    expect(canAccessReport(session({ permissions: ['tax:read'], products: ['POS'] }), 'tax')).toBe(
      true,
    );
  });
});

describe('Tenant-scoped domain entitlement projections', () => {
  function retailAccess(): AuthSession {
    const base = session({
      products: ['POS'],
      capabilities: ['POS_PRODUCT_SALES'],
      permissions: [
        'sales:read',
        'catalog:read',
        'employees:read',
        'commission:read',
        'attendance:read',
        'expenses:read',
        'tax:read',
      ],
      foundations: ['IDENTITY_ACCESS', 'CATALOG', 'CUSTOMER_IDENTITY'],
    });
    return {
      ...base,
      access: {
        ...base.access,
        entitlements: {
          products: {
            POS: {
              enabled: true,
              selling: { PRODUCT: true, SERVICE: false },
              features: { PRODUCT_COMMISSION: false },
            },
          },
          modules: {
            CATALOG: { enabled: true, PRODUCTS: true, SERVICES: false },
            CUSTOMER: {
              enabled: true,
              MEMBERSHIP: { enabled: false, LOYALTY_POINTS: false },
            },
            COMMERCIAL: { PROMOTIONS: false },
            WORKFORCE: { EMPLOYEES: false, ATTENDANCE: false },
            FINANCE: { OPERATIONS: false },
            FISCAL: { TAX: false },
            ANALYTICS: { BUSINESS_INSIGHTS: false },
          },
        },
      },
    };
  }

  it('retail-only tenant keeps base reports, never exposes disabled domain reports', () => {
    const retail = retailAccess();
    expect(canAccessReport(retail, 'transactions')).toBe(true);
    expect(canAccessReport(retail, 'catalog-performance')).toBe(true);
    expect(canAccessReport(retail, 'product-commission')).toBe(false);
    expect(canAccessReport(retail, 'employee-performance')).toBe(false);
    expect(canAccessReport(retail, 'attendance')).toBe(false);
    expect(canAccessReport(retail, 'expenses')).toBe(false);
    expect(canAccessReport(retail, 'tax')).toBe(false);
    expect(canShowDashboardWidget(retail, 'BUSINESS_INSIGHT')).toBe(false);
    expect(canShowDashboardWidget(retail, 'TOP_ITEMS')).toBe(true);
  });

  it('newly entitled finance and tax require grants as well as capabilities', () => {
    const retail = retailAccess();
    const enabled = {
      ...retail,
      access: {
        ...retail.access,
        capabilities: ['POS_PRODUCT_SALES', 'FINANCE_OPERATIONS', 'TAX_FISCAL'],
        entitlements: {
          ...retail.access.entitlements!,
          modules: {
            ...retail.access.entitlements!.modules,
            FINANCE: { OPERATIONS: true },
            FISCAL: { TAX: true },
          },
        },
      },
    };
    expect(canAccessReport(enabled, 'expenses')).toBe(true);
    expect(canAccessReport(enabled, 'tax')).toBe(true);
    expect(
      canAccessReport(
        { ...enabled, access: { ...enabled.access, permissions: ['sales:read'] } },
        'expenses',
      ),
    ).toBe(false);
  });
});
