import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { formatDecimalDisplay } from '../../../shared/format/decimal-display';

import { transactionHistoryCopy } from './transaction-history-copy';

export function useTransactionHistoryLocalization() {
  const base = useBackofficeLocalization();
  const copy = (value: string) => transactionHistoryCopy[value]?.[base.locale] ?? base.copy(value);

  return {
    ...base,
    copy,
    /** Quantities and points without insignificant Runtime scale (`1.5000` → `1,5`). */
    formatQuantity: (value: string) =>
      formatDecimalDisplay(value, base.locale === 'id' ? 'id-ID' : 'en-US'),
  };
}
