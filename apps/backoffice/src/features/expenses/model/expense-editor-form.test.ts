import { describe, expect, it } from 'vitest';

import { testExpense } from './expense-test-fixtures';
import {
  createExpenseEditorForm,
  toExpenseInput,
  validateExpenseEditorForm,
} from './expense-editor-form';

describe('Expense editor form', () => {
  it('starts a new expense empty and dated now', () => {
    const now = new Date('2026-10-02T03:00:00.000Z');
    expect(createExpenseEditorForm(null, () => now)).toEqual({
      sellingLocationId: '',
      financialAccountId: '',
      categoryCode: '',
      amount: '',
      note: '',
      occurredAt: now.toISOString(),
    });
  });

  it('hydrates an existing expense without changing its codes', () => {
    expect(createExpenseEditorForm(testExpense({ note: null }))).toEqual({
      sellingLocationId: 'location-1',
      financialAccountId: 'bca-account',
      categoryCode: 'TRANSPORT',
      amount: '150000',
      note: '',
      occurredAt: '2026-10-01T02:00:00.000Z',
    });
  });

  it('requires location, account, category, amount, and date', () => {
    const validation = validateExpenseEditorForm(createExpenseEditorForm(null));
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual([
      'LOCATION_REQUIRED',
      'ACCOUNT_REQUIRED',
      'CATEGORY_REQUIRED',
      'AMOUNT_REQUIRED',
    ]);
    expect(validateExpenseEditorForm(createExpenseEditorForm(testExpense())).valid).toBe(true);
  });

  it('maps the draft to the Runtime command with an empty description as null', () => {
    const form = { ...createExpenseEditorForm(testExpense()), note: '  ', amount: ' 150000 ' };
    expect(toExpenseInput(form)).toEqual({
      sellingLocationId: 'location-1',
      financialAccountId: 'bca-account',
      categoryCode: 'TRANSPORT',
      amount: '150000',
      note: null,
      occurredAt: '2026-10-01T02:00:00.000Z',
    });
    expect(toExpenseInput({ ...form, note: ' Bensin ' }).note).toBe('Bensin');
  });
});
