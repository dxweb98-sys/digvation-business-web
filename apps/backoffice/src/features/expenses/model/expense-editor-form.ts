import type { Expense, ExpenseInput } from '../api/expense-api';

export interface ExpenseEditorForm {
  sellingLocationId: string;
  financialAccountId: string;
  categoryCode: string;
  /** Decimal string from the currency input; Runtime owns monetary authority. */
  amount: string;
  note: string;
  occurredAt: string;
}

export type ExpenseEditorIssue =
  | 'LOCATION_REQUIRED'
  | 'ACCOUNT_REQUIRED'
  | 'CATEGORY_REQUIRED'
  | 'AMOUNT_REQUIRED'
  | 'DATE_REQUIRED';

export interface ExpenseEditorValidation {
  valid: boolean;
  issues: ExpenseEditorIssue[];
}

/** `now` is injectable so a new draft's default date is testable. */
export function createExpenseEditorForm(
  expense: Expense | null | undefined,
  now: () => Date = () => new Date(),
): ExpenseEditorForm {
  return {
    sellingLocationId: expense?.sellingLocationId ?? '',
    financialAccountId: expense?.financialAccountId ?? '',
    categoryCode: expense?.categoryCode ?? '',
    amount: expense?.amount ?? '',
    note: expense?.note ?? '',
    occurredAt: expense?.occurredAt ?? now().toISOString(),
  };
}

/** Required-field checks only; amount rules, account eligibility, and status stay with Runtime. */
export function validateExpenseEditorForm(form: ExpenseEditorForm): ExpenseEditorValidation {
  const issues: ExpenseEditorIssue[] = [];
  if (!form.sellingLocationId) issues.push('LOCATION_REQUIRED');
  if (!form.financialAccountId) issues.push('ACCOUNT_REQUIRED');
  if (!form.categoryCode) issues.push('CATEGORY_REQUIRED');
  if (!form.amount.trim()) issues.push('AMOUNT_REQUIRED');
  if (!form.occurredAt) issues.push('DATE_REQUIRED');
  return { valid: issues.length === 0, issues };
}

/** Create and update share one command shape; an empty description is sent as `null`. */
export function toExpenseInput(form: ExpenseEditorForm): ExpenseInput {
  return {
    sellingLocationId: form.sellingLocationId,
    financialAccountId: form.financialAccountId,
    categoryCode: form.categoryCode,
    amount: form.amount.trim(),
    note: form.note.trim() || null,
    occurredAt: form.occurredAt,
  };
}
