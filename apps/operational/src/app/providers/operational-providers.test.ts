import type { AuthSession } from '@digvation/business-auth';
import { describe, expect, it } from 'vitest';
import { hasImplementedOperationalSurface } from './operational-providers';

function session(input: {
  products?: string[];
  capabilities?: string[];
  permissions?: string[];
}): AuthSession {
  return {
    identity: { userId: 'user-1', displayName: 'Test', username: 'test', roles: [] },
    business: { tenantId: 'tenant-1', name: 'Test Business', currency: 'IDR' },
    access: {
      products: input.products ?? [],
      capabilities: input.capabilities ?? [],
      foundations: [],
      permissions: input.permissions ?? [],
    },
    preferences: { locale: 'id-ID', timezone: 'Asia/Jakarta', dateFormat: 'DD/MM/YYYY', timeFormat: 'HH:mm' },
    deployment: { profile: 'SHARED' },
    contextVersion: 'test-context',
  };
}

describe('hasImplementedOperationalSurface', () => {
  it('recognizes a WORKSHOP-only entitled user with Intake permissions as having an implemented surface', () => {
    expect(
      hasImplementedOperationalSurface(
        session({
          products: ['WORKSHOP'],
          permissions: ['work-orders:create', 'customers:read'],
        }),
      ),
    ).toBe(true);
  });

  it('does not grant an implemented surface for WORKSHOP entitlement alone, without the Intake permissions', () => {
    expect(
      hasImplementedOperationalSurface(session({ products: ['WORKSHOP'] })),
    ).toBe(false);
  });

  it('keeps existing POS and Finance recognition unchanged', () => {
    expect(
      hasImplementedOperationalSurface(
        session({ products: ['POS'], permissions: ['sales:create'] }),
      ),
    ).toBe(true);
    expect(
      hasImplementedOperationalSurface(
        session({ capabilities: ['FINANCE_OPERATIONS'], permissions: ['expenses:create'] }),
      ),
    ).toBe(true);
    expect(hasImplementedOperationalSurface(session({}))).toBe(false);
  });
});
