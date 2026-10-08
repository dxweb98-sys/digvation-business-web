import { describe, expect, it } from 'vitest';
import { canCreateOperationalExpense } from './operational-expenses-page';

describe('Operational expense create access', () => {
  it('uses expenses:create without requiring the Backoffice-only financial-account permission', () => {
    expect(canCreateOperationalExpense(['expenses:create'])).toBe(true);
    expect(canCreateOperationalExpense(['financial-accounts:read'])).toBe(false);
  });
});
