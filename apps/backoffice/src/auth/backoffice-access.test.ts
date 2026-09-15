import { describe, expect, it } from 'vitest';

import type { BackofficeSession } from './auth-session';
import { canAccessBackoffice, canPerformBackofficeAction } from './backoffice-access';

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
    effectiveFoundations: ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY'],
  };
}

describe('Backoffice effective permission access', () => {
  it('shows a contribution when Runtime projected its read permission', () => {
    expect(canAccessBackoffice(sessionWith('sales:read'), 'transactions')).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'transactions')).toBe(false);
  });

  it('does not duplicate Finance entitlement rules in the Web layer', () => {
    expect(canAccessBackoffice(sessionWith('expenses:read'), 'expenses')).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'expenses')).toBe(false);
  });

  it('uses projected Attendance permission as the visibility authority', () => {
    expect(canAccessBackoffice(sessionWith('attendance:read'), 'attendance')).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'attendance')).toBe(false);
  });

  it('uses projected Promotion permission and keeps mutation grants granular', () => {
    const reader = sessionWith('promotions:read');
    const creator = sessionWith('promotions:read', 'promotions:create');
    const editor = sessionWith('promotions:read', 'promotions:update');

    expect(canAccessBackoffice(reader, 'promotions')).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'promotions')).toBe(false);
    expect(canPerformBackofficeAction(reader, 'createPromotion')).toBe(false);
    expect(canPerformBackofficeAction(creator, 'createPromotion')).toBe(true);
    expect(canPerformBackofficeAction(reader, 'updatePromotion')).toBe(false);
    expect(canPerformBackofficeAction(editor, 'updatePromotion')).toBe(true);
  });

  it('allows shared reporting for any readable authoritative projection', () => {
    expect(canAccessBackoffice(sessionWith('employees:read'), 'reports')).toBe(true);
    expect(canAccessBackoffice(sessionWith('attendance:read'), 'reports')).toBe(true);
    expect(canAccessBackoffice(sessionWith(), 'reports')).toBe(false);
  });
});
