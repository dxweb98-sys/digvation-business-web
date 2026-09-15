import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadAuthenticatedEntitlements,
  loadAuthenticatedRuntimeAvailability,
} from './authenticated-runtime-context';

afterEach(() => {
  vi.unstubAllGlobals();
});

function runtimeResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        effectiveProducts: ['POS'],
        effectiveCapabilities: [
          'FINANCE_OPERATIONS',
          'BUSINESS_ANALYTICS',
          'WORKFORCE_ATTENDANCE',
          'MEMBERSHIP',
          'LOYALTY_POINTS',
          'TAX_FISCAL',
        ],
        effectiveFoundations: [
          'IDENTITY_ACCESS',
          'AUDIT_ACTIVITY',
          'ORGANIZATION_LOCATION',
          'CATALOG',
          'OPERATIONAL_ACCESS',
          'WORKFORCE',
          'CUSTOMER_IDENTITY',
        ],
        effectivePermissions: [
          'auth:self',
          'sales:read',
          'employees:read',
          'attendance:read',
          'tax:read',
        ],
        ...overrides,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('authenticated runtime context', () => {
  it('preserves registered products, capabilities, foundations, and effective permissions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(runtimeResponse()));

    await expect(
      loadAuthenticatedRuntimeAvailability(
        'http://127.0.0.1:4003',
        'access-token',
      ),
    ).resolves.toEqual({
      effectiveEntitlements: {
        products: ['POS'],
        capabilities: [
          'FINANCE_OPERATIONS',
          'BUSINESS_ANALYTICS',
          'WORKFORCE_ATTENDANCE',
          'MEMBERSHIP',
          'LOYALTY_POINTS',
          'TAX_FISCAL',
        ],
      },
      effectiveFoundations: [
        'IDENTITY_ACCESS',
        'AUDIT_ACTIVITY',
        'ORGANIZATION_LOCATION',
        'CATALOG',
        'OPERATIONAL_ACCESS',
        'WORKFORCE',
        'CUSTOMER_IDENTITY',
      ],
      effectivePermissions: [
        'auth:self',
        'sales:read',
        'employees:read',
        'attendance:read',
        'tax:read',
      ],
    });
  });

  it('filters unknown entitlement vocabulary while preserving server-projected permissions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        runtimeResponse({
          effectiveCapabilities: ['WORKFORCE_ATTENDANCE', 'UNKNOWN_FEATURE'],
          effectiveFoundations: ['WORKFORCE', 'UNKNOWN_FOUNDATION'],
          effectivePermissions: ['attendance:read', 'future-domain:read'],
        }),
      ),
    );

    await expect(
      loadAuthenticatedRuntimeAvailability(
        'http://127.0.0.1:4003',
        'access-token',
      ),
    ).resolves.toEqual({
      effectiveEntitlements: {
        products: ['POS'],
        capabilities: ['WORKFORCE_ATTENDANCE'],
      },
      effectiveFoundations: ['WORKFORCE'],
      effectivePermissions: ['attendance:read', 'future-domain:read'],
    });
  });

  it('keeps the entitlement-only helper compatible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(runtimeResponse()));

    await expect(
      loadAuthenticatedEntitlements('http://127.0.0.1:4003', 'access-token'),
    ).resolves.toEqual({
      products: ['POS'],
      capabilities: [
        'FINANCE_OPERATIONS',
        'BUSINESS_ANALYTICS',
        'WORKFORCE_ATTENDANCE',
        'MEMBERSHIP',
        'LOYALTY_POINTS',
        'TAX_FISCAL',
      ],
    });
  });
});
