import { describe, expect, it } from 'vitest';

import {
  canAccessWorkOrderWorkspace,
  canCreateWorkOrder,
  canReadWorkOrders,
} from './work-order-access';

describe('Work Order access', () => {
  it('creating needs work-orders:create and customers:read', () => {
    expect(canCreateWorkOrder(['work-orders:create', 'customers:read'])).toBe(true);
    expect(canCreateWorkOrder(['work-orders:create'])).toBe(false);
    expect(canCreateWorkOrder(['customers:read'])).toBe(false);
  });

  it('reading needs workshop-queue:read only', () => {
    expect(canReadWorkOrders(['workshop-queue:read'])).toBe(true);
    expect(canReadWorkOrders(['work-orders:create', 'customers:read'])).toBe(false);
  });

  it('opens the workspace for readers or creators of an entitled WORKSHOP user', () => {
    expect(canAccessWorkOrderWorkspace(['workshop-queue:read'], true)).toBe(true);
    expect(canAccessWorkOrderWorkspace(['work-orders:create', 'customers:read'], true)).toBe(true);
  });

  it('denies the workspace without the WORKSHOP entitlement or without any Work Order permission', () => {
    expect(canAccessWorkOrderWorkspace(['workshop-queue:read'], false)).toBe(false);
    expect(canAccessWorkOrderWorkspace(['work-orders:create'], true)).toBe(false);
    expect(canAccessWorkOrderWorkspace([], true)).toBe(false);
  });
});
