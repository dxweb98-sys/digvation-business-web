import { describe, expect, it } from 'vitest';
import {
  canAccessOperationalExpenses,
  canAccessWorkshopIntake,
  OperationalNotFoundRoute,
  operationalRouter,
} from './operational-router';

describe('Operational expense navigation access', () => {
  it('allows the Expenses module for an entitled user who can create an expense', () => {
    expect(canAccessOperationalExpenses(['expenses:create'], true)).toBe(true);
    expect(canAccessOperationalExpenses(['expenses:create'], false)).toBe(false);
  });
});

describe('Workshop Intake navigation access', () => {
  it('exposes Intake to a WORKSHOP-entitled user with work-orders:create and customers:read', () => {
    expect(
      canAccessWorkshopIntake(['work-orders:create', 'customers:read'], true),
    ).toBe(true);
  });

  it('does not require POS entitlement or permissions', () => {
    // hasWorkshop=true with no POS-related permission is enough.
    expect(
      canAccessWorkshopIntake(['work-orders:create', 'customers:read'], true),
    ).toBe(true);
  });

  it('denies Intake when WORKSHOP is not entitled, even with the permissions present', () => {
    expect(
      canAccessWorkshopIntake(['work-orders:create', 'customers:read'], false),
    ).toBe(false);
  });

  it('denies Intake without work-orders:create', () => {
    expect(canAccessWorkshopIntake(['customers:read'], true)).toBe(false);
  });

  it('denies Intake without customers:read, since intake requires customer lookup', () => {
    expect(canAccessWorkshopIntake(['work-orders:create'], true)).toBe(false);
  });
});

describe('Operational route registration', () => {
  it('registers the Workshop Intake route alongside existing POS/Finance routes', () => {
    const paths = operationalRouter.routes
      .flatMap((route) => route.children ?? [])
      .map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining(['/sell', '/sell/:saleId', '/expenses', '/workshop/intake']),
    );
  });
});

describe('Operational route fallback', () => {
  it('renders the canonical 404 state for unknown routes', () => {
    const fallback = operationalRouter.routes
      .flatMap((route) => route.children ?? [])
      .find((route) => route.path === '*');

    expect((fallback?.element as { type?: unknown } | undefined)?.type).toBe(
      OperationalNotFoundRoute,
    );
  });
});
