import { describe, expect, it } from 'vitest';
import {
  canAccessOperationalExpenses,
  OperationalNotFoundRoute,
  operationalRouter,
} from './operational-router';

describe('Operational expense navigation access', () => {
  it('allows the Expenses module for an entitled user who can create an expense', () => {
    expect(canAccessOperationalExpenses(['expenses:create'], true)).toBe(true);
    expect(canAccessOperationalExpenses(['expenses:create'], false)).toBe(false);
  });
});

describe('Operational route registration', () => {
  it('registers one Work Order workspace alongside existing POS/Finance routes', () => {
    const paths = operationalRouter.routes
      .flatMap((route) => route.children ?? [])
      .map((route) => route.path);

    expect(paths).toEqual(
      expect.arrayContaining(['/sell', '/sell/:saleId', '/expenses', '/workshop/work-orders']),
    );
  });

  it('sends the former Intake and Queue URLs to the Work Order workspace', () => {
    const children = operationalRouter.routes.flatMap((route) => route.children ?? []);
    for (const path of ['/workshop/intake', '/workshop/queue']) {
      const route = children.find((item) => item.path === path);
      const element = route?.element as { props?: { to?: string; replace?: boolean } } | undefined;
      expect(element?.props?.to).toBe('/workshop/work-orders');
      expect(element?.props?.replace).toBe(true);
    }
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
