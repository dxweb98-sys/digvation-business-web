import { DSelectFilter } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';

import type { Expense, ExpenseApi, ExpenseStatus } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';
import {
  EXPENSE_STATUSES,
  expenseCategoryOptions,
  expenseReferenceOptions,
  expenseStatusLabel,
} from '../model/expense-model';
import { expenseEditorKeys } from './expense-dialog';

export interface ExpenseFilterState {
  q: string;
  status: '' | ExpenseStatus;
  sellingLocationId: string;
  categoryCode: string;
  financialAccountId: string;
}

export const EMPTY_EXPENSE_FILTERS: ExpenseFilterState = {
  q: '',
  status: '',
  sellingLocationId: '',
  categoryCode: '',
  financialAccountId: '',
};

export const expenseFilterKeys = { accounts: ['expense-filter-accounts'] as const };

/** Server-side list filters: status, selling location, category, and source account. */
export function ExpenseFilters({
  api,
  value,
  rows,
  onChange,
}: {
  api: Pick<ExpenseApi, 'listLocations' | 'listFilterAccounts'>;
  value: ExpenseFilterState;
  /** Loaded rows keep a referenced location/account labelled even when the list omits it. */
  rows: readonly Expense[];
  onChange: (change: Partial<ExpenseFilterState>) => void;
}) {
  const { copy, labels } = useExpensesLocalization();
  // Shares the editor's location cache; both read the same tenant location list.
  const locations = useQuery({
    queryKey: expenseEditorKeys.locations,
    queryFn: () => api.listLocations(),
  });
  const accounts = useQuery({
    queryKey: expenseFilterKeys.accounts,
    queryFn: () => api.listFilterAccounts(),
  });
  const inactive = copy('Inactive');

  return (
    <>
      <DSelectFilter
        label={copy('Status')}
        value={value.status || null}
        clearable
        onChange={(status) => onChange({ status: (status ?? '') as '' | ExpenseStatus })}
        options={EXPENSE_STATUSES.map((status) => ({
          value: status,
          label: expenseStatusLabel(status, copy),
        }))}
      />
      <DSelectFilter
        label={copy('Selling location')}
        value={value.sellingLocationId || null}
        clearable
        searchable
        onChange={(id) => onChange({ sellingLocationId: String(id ?? '') })}
        options={expenseReferenceOptions(
          locations.data?.items ?? [],
          rows.map((row) => ({ id: row.sellingLocationId, name: row.sellingLocationName })),
          inactive,
        )}
      />
      <DSelectFilter
        label={copy('Category')}
        value={value.categoryCode || null}
        clearable
        onChange={(code) => onChange({ categoryCode: String(code ?? '') })}
        options={expenseCategoryOptions(labels, value.categoryCode || undefined)}
      />
      <DSelectFilter
        label={copy('Source account')}
        value={value.financialAccountId || null}
        clearable
        searchable
        onChange={(id) => onChange({ financialAccountId: String(id ?? '') })}
        options={expenseReferenceOptions(
          accounts.data?.items ?? [],
          rows.map((row) => ({ id: row.financialAccountId, name: row.financialAccountName })),
          inactive,
        )}
      />
    </>
  );
}

export function hasActiveExpenseFilters({ q, ...filters }: ExpenseFilterState) {
  return Boolean(q.trim()) || Object.values(filters).some(Boolean);
}

/** Only provided filters are sent; Runtime combines them with AND inside its own scope. */
export function toExpenseQuery({
  q,
  status,
  sellingLocationId,
  categoryCode,
  financialAccountId,
}: ExpenseFilterState) {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(status ? { status } : {}),
    ...(sellingLocationId ? { sellingLocationId } : {}),
    ...(categoryCode ? { categoryCode } : {}),
    ...(financialAccountId ? { financialAccountId } : {}),
  };
}
