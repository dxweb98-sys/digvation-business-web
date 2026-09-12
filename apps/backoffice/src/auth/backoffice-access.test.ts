import { describe, expect, it } from 'vitest';

import type { EffectiveEntitlementConfig } from '@digvation/business-runtime';

import type { BackofficeSession } from './auth-session';
import { canAccessBackoffice } from './backoffice-access';

function sessionWith(...permissions: string[]): BackofficeSession {
  return {
    identity: {
      userId: 'user-1',
      displayName: 'Test User',
      workspace: 'test',
      permissions,
      roles: [],
    },
    effectiveEntitlements: { products: [], capabilities: [] },
  };
}

const platformOnly: EffectiveEntitlementConfig = {
  products: [],
  capabilities: [],
};

describe('Backoffice entitlement access', () => {
  it('requires POS for the transaction contribution', () => {
    const session = sessionWith('sales:read');

    expect(canAccessBackoffice(session, 'transactions', platformOnly)).toBe(false);
    expect(
      canAccessBackoffice(session, 'transactions', {
        ...platformOnly,
        products: ['POS'],
      }),
    ).toBe(true);
  });

  it('requires Finance Operations for finance contributions', () => {
    const session = sessionWith('expenses:read');

    expect(canAccessBackoffice(session, 'expenses', platformOnly)).toBe(false);
    expect(
      canAccessBackoffice(session, 'expenses', {
        ...platformOnly,
        capabilities: ['FINANCE_OPERATIONS'],
      }),
    ).toBe(true);
  });

  it('requires Workforce Attendance plus read permission for attendance', () => {
    const session = sessionWith('attendance:read');

    expect(canAccessBackoffice(session, 'attendance', platformOnly)).toBe(false);
    expect(
      canAccessBackoffice(session, 'attendance', {
        ...platformOnly,
        capabilities: ['WORKFORCE_ATTENDANCE'],
      }),
    ).toBe(true);
    expect(
      canAccessBackoffice(sessionWith(), 'attendance', {
        ...platformOnly,
        capabilities: ['WORKFORCE_ATTENDANCE'],
      }),
    ).toBe(false);
  });

  it('allows shared reporting for any readable authoritative projection', () => {
    expect(canAccessBackoffice(sessionWith('employees:read'), 'reports', platformOnly)).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'reports', platformOnly)).toBe(false);
  });
});
