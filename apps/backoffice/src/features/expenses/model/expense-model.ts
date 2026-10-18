import type { BadgeVariant } from '@digvation/ui';

import {
  humanReadableLabel,
  type HumanLabelLocale,
} from '../../../app/localization/human-readable-labels';
import type {
  Expense,
  ExpenseOrigin,
  ExpenseSourceAccountType,
  ExpenseStatus,
} from '../api/expense-api';

/** Runtime expense category codes. These stay the transport/domain values; only labels vary. */
export const EXPENSE_CATEGORY_CODES = ['OPERATIONS', 'TRANSPORT', 'SUPPLIES', 'OTHER'] as const;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  OPERATIONS: 'Operations',
  TRANSPORT: 'Transport',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
};

export const EXPENSE_STATUSES: readonly ExpenseStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const EXPENSE_STATUS_BADGES: Record<ExpenseStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'secondary',
};

const EXPENSE_ORIGIN_LABELS: Record<ExpenseOrigin, string> = {
  BACKOFFICE: 'Backoffice',
  OPERATIONAL: 'Operational',
};

/** Account types Runtime accepts as an expense source. */
const EXPENSE_SOURCE_ACCOUNT_TYPES: readonly string[] = ['CASH', 'BANK', 'E_WALLET'];

export function isExpenseSourceAccountType(type: string): type is ExpenseSourceAccountType {
  return EXPENSE_SOURCE_ACCOUNT_TYPES.includes(type);
}

export const EMPTY_VALUE = '—';

export interface ExpenseLabelContext {
  copy: (value: string) => string;
  locale: HumanLabelLocale;
}

/**
 * The single expense category presentation. Known codes use expense copy; an unknown future
 * code is humanized (e.g. `FUEL_COST` → "Fuel Cost") rather than shown raw.
 */
export function expenseCategoryLabel(categoryCode: string, { copy, locale }: ExpenseLabelContext) {
  const label = EXPENSE_CATEGORY_LABELS[categoryCode];
  return label ? copy(label) : humanReadableLabel(categoryCode, locale);
}

export function expenseCategoryOptions(context: ExpenseLabelContext, currentCode?: string) {
  const codes: string[] = [...EXPENSE_CATEGORY_CODES];
  if (currentCode && !codes.includes(currentCode)) codes.push(currentCode);
  return codes.map((value) => ({ value, label: expenseCategoryLabel(value, context) }));
}

export interface ExpenseReference {
  id: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

/**
 * Filter options for a referenced location or account. Names are shown as configured; inactive
 * records stay listed (marked) and references seen on loaded rows are kept, so a historical value
 * outside the reference list never becomes an unlabelled id.
 */
export function expenseReferenceOptions(
  references: readonly ExpenseReference[],
  rowReferences: readonly ExpenseReference[],
  inactiveLabel: string,
) {
  const options = new Map<string, { value: string; label: string }>();
  for (const reference of [...references, ...rowReferences]) {
    if (options.has(reference.id)) continue;
    options.set(reference.id, {
      value: reference.id,
      label:
        reference.status === 'INACTIVE' ? `${reference.name} (${inactiveLabel})` : reference.name,
    });
  }
  return [...options.values()];
}

export function expenseStatusLabel(status: ExpenseStatus, copy: (value: string) => string) {
  return copy(EXPENSE_STATUS_LABELS[status]);
}

export function expenseStatusBadgeVariant(status: ExpenseStatus): BadgeVariant {
  return EXPENSE_STATUS_BADGES[status];
}

export function expenseOriginLabel(origin: string, { copy, locale }: ExpenseLabelContext) {
  const label = EXPENSE_ORIGIN_LABELS[origin as ExpenseOrigin];
  return label ? copy(label) : humanReadableLabel(origin, locale);
}

/** Runtime projects readable actor names; stable actor IDs are never shown. */
export function actorDisplayName(actor: Expense['createdBy'], fallback: string) {
  return actor?.displayName?.trim() || fallback;
}

export function expenseDescription(note: string | null) {
  return note?.trim() || EMPTY_VALUE;
}

export function isExpenseEditable(expense: Pick<Expense, 'status'>) {
  return expense.status === 'PENDING';
}
