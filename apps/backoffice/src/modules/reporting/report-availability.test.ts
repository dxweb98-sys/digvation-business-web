import type { AuthSession } from '@digvation/business-auth';
import { describe, expect, it } from 'vitest';

import { canAccessReport } from './report-availability';

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
    expect(
      canAccessReport(session({ permissions: ['attendance:read'] }), 'attendance'),
    ).toBe(true);
    expect(canAccessReport(session({ permissions: [] }), 'attendance')).toBe(false);
    expect(canAccessReport(session({ permissions: ['expenses:read'] }), 'expenses')).toBe(true);
  });

  it('keeps tax reports POS-scoped after TAX_FISCAL has made tax:read effective', () => {
    expect(canAccessReport(session({ permissions: ['tax:read'] }), 'tax')).toBe(false);
    expect(
      canAccessReport(session({ permissions: ['tax:read'], products: ['POS'] }), 'tax'),
    ).toBe(true);
  });
});
