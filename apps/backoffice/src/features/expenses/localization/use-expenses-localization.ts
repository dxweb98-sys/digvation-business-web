import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';

import type { ExpenseLabelContext } from '../model/expense-model';
import { expensesCopy } from './expenses-copy';

export function useExpensesLocalization() {
  const base = useBackofficeLocalization();
  const copy = (value: string) => expensesCopy[value]?.[base.locale] ?? base.copy(value);
  const labels: ExpenseLabelContext = { copy, locale: base.locale };

  return { ...base, copy, labels };
}
