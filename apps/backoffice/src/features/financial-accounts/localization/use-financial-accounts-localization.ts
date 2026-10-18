import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';

import type { FinancialAccountType } from '../api/financial-accounts-api';
import { ACCOUNT_TYPE_LABELS } from '../model/financial-account-model';
import { financialAccountsCopy } from './financial-accounts-copy';

export function useFinancialAccountsLocalization() {
  const base = useBackofficeLocalization();

  return {
    ...base,
    copy: (value: string) => financialAccountsCopy[value]?.[base.locale] ?? base.copy(value),
  };
}

/** Localized account-type label, for features that reference a Financial Account by type. */
export function useFinancialAccountTypeLabel() {
  const { copy } = useFinancialAccountsLocalization();
  return (type: FinancialAccountType) => copy(ACCOUNT_TYPE_LABELS[type]);
}
