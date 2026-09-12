import { describe, expect, it } from 'vitest';

import type { BackofficeSession } from '../../auth/auth-session';
import { canAccessReport } from './report-availability';

function session(input: {
  permissions?: string[];
  products?: Array<'POS'>;
  capabilities?: BackofficeSession['effectiveEntitlements']['capabilities'];
  foundations?: BackofficeSession['effectiveFoundations'];
} = {}): BackofficeSession {
  return {
    identity: {
      userId: 'user-1',
      displayName: 'Test User',
      workspace: 'test',
      permissions: input.permissions ?? [],
      roles: [],
    },
    effectiveEntitlements: {
      products: input.products ?? [],
      capabilities: input.capabilities ?? [],
    },
    effectiveFoundations: input.foundations ?? ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY'],
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

  it('keeps tax reports POS-scoped after TAX_FISCAL has made tax:read effective', () => {
    expect(canAccessReport(session({ permissions: ['tax:read'] }), 'tax')).toBe(false);
    expect(
      canAccessReport(session({ permissions: ['tax:read'], products: ['POS'] }), 'tax'),
    ).toBe(true);
  });
});
