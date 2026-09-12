import { describe, expect, it } from 'vitest';

import type { RuntimeAvailabilityConfig } from '@digvation/business-runtime';
import { effectiveBusinessPermissions } from './effective-business-permissions';

function availability(
  overrides: Partial<RuntimeAvailabilityConfig> = {},
): RuntimeAvailabilityConfig {
  return {
    effectiveEntitlements: { products: [], capabilities: [] },
    effectiveFoundations: ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY'],
    ...overrides,
  };
}

describe('effectiveBusinessPermissions', () => {
  it('removes workforce permissions when Workforce is not resolved', () => {
    expect(
      effectiveBusinessPermissions(
        ['auth:self', 'employees:read', 'attendance:read'],
        availability(),
      ),
    ).toEqual(['auth:self']);
  });

  it('keeps workforce and attendance permissions only when their availability is resolved', () => {
    expect(
      effectiveBusinessPermissions(
        ['employees:read', 'attendance:read', 'attendance:manage'],
        availability({
          effectiveEntitlements: {
            products: [],
            capabilities: ['WORKFORCE_ATTENDANCE'],
          },
          effectiveFoundations: [
            'IDENTITY_ACCESS',
            'AUDIT_ACTIVITY',
            'WORKFORCE',
          ],
        }),
      ),
    ).toEqual(['employees:read', 'attendance:read', 'attendance:manage']);
  });

  it('projects POS, Finance, Tax, Catalog, and organization permissions independently', () => {
    const granted = [
      'sales:read',
      'catalog:read',
      'expenses:read',
      'tax:read',
      'locations:read',
      'roles:read',
    ];
    const result = effectiveBusinessPermissions(
      granted,
      availability({
        effectiveEntitlements: {
          products: ['POS'],
          capabilities: ['TAX_FISCAL'],
        },
        effectiveFoundations: [
          'IDENTITY_ACCESS',
          'AUDIT_ACTIVITY',
          'ORGANIZATION_LOCATION',
          'CATALOG',
          'OPERATIONAL_ACCESS',
        ],
      }),
    );

    expect(result).toEqual([
      'sales:read',
      'catalog:read',
      'tax:read',
      'locations:read',
      'roles:read',
    ]);
  });
});
