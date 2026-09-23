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
