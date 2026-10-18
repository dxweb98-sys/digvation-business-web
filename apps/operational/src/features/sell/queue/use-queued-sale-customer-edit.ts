import { useState } from 'react';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import type { WalkInCustomerEditTarget } from '../customer/ui/walk-in-customer-edit-dialog';
import { transactionNumber } from '../transaction/model/sale-display';
import type { Dispatch, SetStateAction } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { useToast } from '@digvation-labs/ui';
import type { createCashierTransactionAdapter } from '../transaction/api/cashier-transaction-adapter-factory';
import type { OperationalQueuePage } from '../transaction/api/operational-projection-client';

/**
 * Correcting the walk-in customer of an unfinished queued Sale. The Sale is re-read first; the
 * queue and an open queue detail are refreshed with the corrected Sale.
 */
export function useQueuedSaleCustomerEdit({
  adapter,
  workspace,
  transactionsQuery,
  queueDetail,
  setQueueDetail,
  refreshQueue,
  showToast,
  copy,
}: {
  adapter: ReturnType<typeof createCashierTransactionAdapter>;
  workspace: { locale: string };
  transactionsQuery: UseQueryResult<OperationalQueuePage, Error>;
  queueDetail: Sale | null;
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  refreshQueue: () => void;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const [customerEditTarget, setCustomerEditTarget] = useState<WalkInCustomerEditTarget | null>(
    null,
  );
  /** Only an unfinished transaction of a walk-in customer: a Member is edited in Member management. */
  const openCustomerEdit = (target: Sale) => {
    if (target.status !== 'OPEN' || target.customer?.type !== 'NON_MEMBER') return;
    setCustomerEditTarget({
      saleId: target.id,
      reference: transactionNumber(target, workspace.locale),
      customer: { name: target.customer.name, phoneE164: target.customer.phoneE164 },
    });
  };
  const saveCustomerEdit = async (saleId: string, input: { name: string; phone: string }) => {
    const current =
      transactionsQuery.data?.items.find((entry) => entry.id === saleId) ?? queueDetail;
    // The Sale is re-read first so the correction never rides on a stale version.
    const fresh = await adapter.getSale(saleId);
    if (fresh.status !== 'OPEN' || fresh.customer?.type !== 'NON_MEMBER') {
      setCustomerEditTarget(null);
      refreshQueue();
      throw new Error('SALE_NOT_OPEN');
    }
    const updated = await adapter.setSaleCustomer(
      saleId,
      {
        expectedVersion: fresh.version,
        customer: { type: 'NON_MEMBER', name: input.name, phone: input.phone },
      },
      `customer-correction-${saleId}-${crypto.randomUUID()}`,
    );
    setCustomerEditTarget(null);
    if (queueDetail?.id === saleId || current?.id === saleId)
      setQueueDetail((detail) => (detail?.id === saleId ? updated : detail));
    refreshQueue();
    showToast({
      title: copy('Customer updated'),
      description: transactionNumber(updated, workspace.locale),
      variant: 'success',
    });
  };
  return { customerEditTarget, setCustomerEditTarget, openCustomerEdit, saveCustomerEdit };
}
