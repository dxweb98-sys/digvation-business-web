import { DDateRangeFilter, DSelectFilter } from '@digvation/ui';

import type {
  FulfillmentStatus,
  PaymentStatus,
  SaleStatus,
  TransactionHistoryQuery,
} from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import {
  FULFILLMENT_STATUS_LABELS,
  PAYMENT_ATTEMPT_STATUS_LABELS,
  SALE_STATUS_LABELS,
} from '../model/transaction-summary';

export interface TransactionFilterState {
  q: string;
  saleStatus: '' | SaleStatus;
  paymentStatus: '' | PaymentStatus;
  fulfillmentStatus: '' | FulfillmentStatus;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterState = {
  q: '',
  saleStatus: '',
  paymentStatus: '',
  fulfillmentStatus: '',
  createdFrom: '',
  createdTo: '',
};

const options = <V extends string>(labels: Record<V, string>, copy: (value: string) => string) =>
  (Object.keys(labels) as V[]).map((value) => ({ value, label: copy(labels[value]) }));

/** Runtime list filters, sent unchanged; labels are the feature's localized copy. */
export function TransactionHistoryFilters({
  value,
  onChange,
}: {
  value: TransactionFilterState;
  onChange: (change: Partial<TransactionFilterState>) => void;
}) {
  const { copy } = useTransactionHistoryLocalization();
  return (
    <>
      <DSelectFilter
        label={copy('Transaction status')}
        value={value.saleStatus || null}
        clearable
        onChange={(status) => onChange({ saleStatus: (status ?? '') as '' | SaleStatus })}
        options={options(SALE_STATUS_LABELS, copy)}
      />
      <DSelectFilter
        label={copy('Payment status')}
        value={value.paymentStatus || null}
        clearable
        onChange={(status) => onChange({ paymentStatus: (status ?? '') as '' | PaymentStatus })}
        options={options(PAYMENT_ATTEMPT_STATUS_LABELS, copy)}
      />
      <DSelectFilter
        label={copy('Work status')}
        value={value.fulfillmentStatus || null}
        clearable
        onChange={(status) =>
          onChange({ fulfillmentStatus: (status ?? '') as '' | FulfillmentStatus })
        }
        options={options(FULFILLMENT_STATUS_LABELS, copy)}
      />
      <DDateRangeFilter
        from={value.createdFrom}
        to={value.createdTo}
        onFromChange={(createdFrom) => onChange({ createdFrom })}
        onToChange={(createdTo) => onChange({ createdTo })}
        onClear={() => onChange({ createdFrom: '', createdTo: '' })}
      />
    </>
  );
}

/** Only provided filters are sent; their Runtime meaning is unchanged. */
export function toTransactionQuery({
  q,
  saleStatus,
  paymentStatus,
  fulfillmentStatus,
  createdFrom,
  createdTo,
}: TransactionFilterState): Omit<TransactionHistoryQuery, 'limit' | 'offset'> {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(saleStatus ? { saleStatus } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
  };
}
