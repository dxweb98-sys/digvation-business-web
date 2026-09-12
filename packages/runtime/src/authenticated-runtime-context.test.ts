import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadAuthenticatedEntitlements,
  loadAuthenticatedRuntimeAvailability,
} from './authenticated-runtime-context';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated runtime context', () => {
  it('preserves registered products, capabilities, and resolved foundations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
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
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      loadAuthenticatedRuntimeAvailability('http://127.0.0.1:4003', 'access-token'),
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
    });
  });

  it('keeps the entitlement-only compatibility reader', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              effectiveProducts: ['POS'],
              effectiveCapabilities: ['MEMBERSHIP', 'TAX_FISCAL'],
              effectiveFoundations: ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY', 'CUSTOMER_IDENTITY'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      loadAuthenticatedEntitlements('http://127.0.0.1:4003', 'access-token'),
    ).resolves.toEqual({
      products: ['POS'],
      capabilities: ['MEMBERSHIP', 'TAX_FISCAL'],
    });
  });

  it('ignores unknown availability values instead of exposing them to application access', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              effectiveProducts: ['POS'],
              effectiveCapabilities: ['WORKFORCE_ATTENDANCE', 'UNKNOWN_FEATURE'],
              effectiveFoundations: ['WORKFORCE', 'UNKNOWN_FOUNDATION'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      loadAuthenticatedRuntimeAvailability('http://127.0.0.1:4003', 'access-token'),
    ).resolves.toEqual({
      effectiveEntitlements: {
        products: ['POS'],
        capabilities: ['WORKFORCE_ATTENDANCE'],
      },
      effectiveFoundations: ['WORKFORCE'],
    });
  });
});
