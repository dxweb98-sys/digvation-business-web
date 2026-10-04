import type { AuthSession } from '@digvation/business-auth';
import { describe, expect, it } from 'vitest';

import {
  BACKOFFICE_ACCESS_PERMISSION,
  canAccessBackoffice,
  canPerformBackofficeAction,
} from './backoffice-access';

function sessionWith(...permissions: string[]): AuthSession {
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
      products: [],
      capabilities: [],
      foundations: ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY'],
      permissions,
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

function backofficeSessionWith(...permissions: string[]): AuthSession {
  return sessionWith(BACKOFFICE_ACCESS_PERMISSION, ...permissions);
}

describe('Backoffice effective permission access', () => {
  it('keeps the Customer directory independent of Membership entitlement and grants', () => {
    const base = backofficeSessionWith('customers:read');
    const customer = { ...base, access: { ...base.access, foundations: ['CUSTOMER_IDENTITY'] } };
    expect(canAccessBackoffice(customer, 'customers')).toBe(true);
    expect(canAccessBackoffice(customer, 'memberships')).toBe(false);
    expect(canPerformBackofficeAction(customer, 'manageCustomer')).toBe(false);
    expect(
      canPerformBackofficeAction(
        {
          ...customer,
          access: {
            ...customer.access,
            permissions: [...customer.access.permissions, 'customers:manage'],
          },
        },
        'manageCustomer',
      ),
    ).toBe(true);
    expect(
      canAccessBackoffice(
        { ...customer, access: { ...customer.access, foundations: [] } },
        'customers',
      ),
    ).toBe(false);
  });

  it('requires both Membership entitlement and read permission for Membership navigation', () => {
    const base = backofficeSessionWith('membership:read');
    expect(canAccessBackoffice(base, 'memberships')).toBe(false);
    const member = { ...base, access: { ...base.access, capabilities: ['MEMBERSHIP'] } };
    expect(canAccessBackoffice(member, 'memberships')).toBe(true);
    expect(canAccessBackoffice(member, 'customers')).toBe(false);
    expect(
      canAccessBackoffice(
        { ...member, access: { ...member.access, permissions: [BACKOFFICE_ACCESS_PERMISSION] } },
        'memberships',
      ),
    ).toBe(false);
  });

  it('shows a contribution when Runtime projected its read permission', () => {
    expect(
      canAccessBackoffice(
        backofficeSessionWith('sales:read', 'sales:read-completed'),
        'transactions',
      ),
    ).toBe(true);
    // Without completed-transaction access the history would only hold summaries.
    expect(canAccessBackoffice(backofficeSessionWith('sales:read'), 'transactions')).toBe(false);
    expect(canAccessBackoffice(backofficeSessionWith(), 'transactions')).toBe(false);
  });

  it('does not duplicate Finance entitlement rules in the Web layer', () => {
    expect(canAccessBackoffice(backofficeSessionWith('expenses:read'), 'expenses')).toBe(true);
    expect(canAccessBackoffice(backofficeSessionWith(), 'expenses')).toBe(false);
  });

  it('uses projected Attendance permission as the visibility authority', () => {
    expect(canAccessBackoffice(backofficeSessionWith('attendance:read'), 'attendance')).toBe(true);
    expect(canAccessBackoffice(backofficeSessionWith(), 'attendance')).toBe(false);
  });

  it('uses projected Promotion permission and keeps mutation grants granular', () => {
    const reader = backofficeSessionWith('promotions:read');
    const creator = backofficeSessionWith('promotions:read', 'promotions:create');
    const editor = backofficeSessionWith('promotions:read', 'promotions:update');

    expect(canAccessBackoffice(reader, 'promotions')).toBe(true);
    expect(canAccessBackoffice(backofficeSessionWith(), 'promotions')).toBe(false);
    expect(canPerformBackofficeAction(reader, 'createPromotion')).toBe(false);
    expect(canPerformBackofficeAction(creator, 'createPromotion')).toBe(true);
    expect(canPerformBackofficeAction(reader, 'updatePromotion')).toBe(false);
    expect(canPerformBackofficeAction(editor, 'updatePromotion')).toBe(true);
  });

  it('allows shared reporting for any readable authoritative projection', () => {
    expect(canAccessBackoffice(backofficeSessionWith('employees:read'), 'reports')).toBe(true);
    expect(canAccessBackoffice(backofficeSessionWith('attendance:read'), 'reports')).toBe(true);
    expect(canAccessBackoffice(backofficeSessionWith(), 'reports')).toBe(false);
    // Tax Reporting alone opens Reporting; it never depends on transaction access.
    expect(canAccessBackoffice(backofficeSessionWith('tax:read'), 'reports')).toBe(true);
  });

  it('does not treat an Operational role name or its permissions as Backoffice authority', () => {
    const operationalOnly = sessionWith(
      'sales:read',
      'sales:create',
      'sales:update',
      'locations:read',
      'catalog:read',
      'pricing:read',
    );
    operationalOnly.identity.roles = [
      {
        id: 'role-cashier',
        code: 'CASHIER',
        name: 'Cashier',
        systemKey: null,
      },
    ];

    expect(canAccessBackoffice(operationalOnly, 'dashboard')).toBe(false);
    expect(canAccessBackoffice(operationalOnly, 'catalog')).toBe(false);
    expect(canPerformBackofficeAction(operationalOnly, 'viewSellingLocations')).toBe(false);

    operationalOnly.identity.roles = [
      {
        id: 'role-mechanic',
        code: 'MECHANIC',
        name: 'Mechanic',
        systemKey: null,
      },
    ];
    expect(canAccessBackoffice(operationalOnly, 'dashboard')).toBe(false);
  });
});
