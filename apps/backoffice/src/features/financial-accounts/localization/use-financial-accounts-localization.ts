import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';

import { financialAccountsCopy } from './financial-accounts-copy';

export function useFinancialAccountsLocalization() {
  const base = useBackofficeLocalization();

  return {
    ...base,
    copy: (value: string) => financialAccountsCopy[value]?.[base.locale] ?? base.copy(value),
  };
}
