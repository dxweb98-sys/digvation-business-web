import { DBadge } from '@digvation/ui';

import { useFinancialAccountTypeLabel } from '../../financial-accounts';
import type { Expense } from '../api/expense-api';
import { useExpensesLocalization } from '../localization/use-expenses-localization';
import { expenseStatusBadgeVariant, expenseStatusLabel } from '../model/expense-model';

export function ExpenseStatusBadge({ status }: { status: Expense['status'] }) {
  const { copy } = useExpensesLocalization();
  return (
    <DBadge variant={expenseStatusBadgeVariant(status)}>{expenseStatusLabel(status, copy)}</DBadge>
  );
}

/**
 * Source account identity: the account name stays exactly as configured (acronyms such as BCA
 * are business names), with its account type as a quiet second line.
 */
export function ExpenseSourceAccount({
  expense,
}: {
  expense: Pick<Expense, 'financialAccountName' | 'financialAccountType'>;
}) {
  const accountTypeLabel = useFinancialAccountTypeLabel();
  return (
    <div className="min-w-0">
      <p className="font-medium text-[var(--color-text)]">{expense.financialAccountName}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {accountTypeLabel(expense.financialAccountType)}
      </p>
    </div>
  );
}
