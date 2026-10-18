import { describe, expect, it } from 'vitest';

import { resolveOperationalSurfaceAccess } from './operational-surface-access';

const base = {
  products: ['POS'],
  capabilities: ['FINANCE_OPERATIONS'],
  foundations: ['OPERATIONAL_ACCESS', 'CUSTOMER_IDENTITY'],
};
const resolve = (permissions: string[], overrides: Partial<typeof base> = {}) =>
  resolveOperationalSurfaceAccess({ ...base, ...overrides, permissions });

describe('resolveOperationalSurfaceAccess', () => {
  it('opens Sell for a cashier with sales:create', () => {
    expect(resolve(['sales:create']).home).toBe('/sell');
  });

  it('does not treat customers:read or any other sales:* permission as POS access', () => {
    const customersOnly = resolve(['customers:read']);
    expect(customersOnly.canSell).toBe(false);
    expect(customersOnly.home).toBe('/customers');
    const salesRead = resolve(['sales:read']);
    expect(salesRead.canSell).toBe(false);
    expect(salesRead.home).toBeNull();
    expect(salesRead.denial).toBe('NO_PERMITTED_MODULE');
  });

  it('denies payment-only and activity-only roles with a role explanation', () => {
    const access = resolve(['payments:read', 'payments:settle', 'activity:read']);
    expect(access.home).toBeNull();
    expect(access.denial).toBe('NO_PERMITTED_MODULE');
  });

  it('reports the module as not enabled when POS is off and nothing else is enabled', () => {
    const access = resolve(['sales:create'], {
      products: [],
      capabilities: [],
      foundations: ['OPERATIONAL_ACCESS'],
    });
    expect(access.canSell).toBe(false);
    expect(access.home).toBeNull();
    expect(access.denial).toBe('MODULE_NOT_ENABLED');
  });

  it('prefers Sell, then Expenses, then Customers as the home', () => {
    expect(resolve(['expenses:read', 'customers:read']).home).toBe('/expenses');
    expect(resolve(['customers:read']).home).toBe('/customers');
  });
});
