import { describe, expect, it } from 'vitest';
import { canAccessOperationalExpenses } from './operational-router';

describe('Operational expense navigation access', () => {
  it('allows the Expenses module for an entitled user who can create an expense', () => {
    expect(canAccessOperationalExpenses(['expenses:create'], true)).toBe(true);
    expect(canAccessOperationalExpenses(['expenses:create'], false)).toBe(false);
  });
});
