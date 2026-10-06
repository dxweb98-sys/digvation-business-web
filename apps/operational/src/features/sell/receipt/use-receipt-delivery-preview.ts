import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOperationalAccessContext } from '../../../shared/operational-access/operational-access-api';
import { resolveReceiptLocation } from '../../../shared/operational-access/operational-location-selection';
import type { QueueSale } from '../transaction/model/cashier-transaction.types';
import { isCompletedSaleSummary } from '../transaction/model/completed-sale-visibility';
import { receiptDeliveryStatusKey, type ReceiptDeliveryTarget } from './receipt-delivery-dialog';
import { receiptDeliveryPhase } from './receipt-delivery';
import { transactionNumber } from '../transaction/model/sale-display';
import { customerDisplayName } from '../customer/model/sale-customer-display';
import type { createCashierTransactionAdapter } from '../transaction/api/cashier-transaction-adapter-factory';
import type { Sale } from '../transaction/model/cashier-transaction.types';

/**
 * Receipt of the transaction on screen: its printed location, the WhatsApp delivery status (polled
 * while a send is pending) and the delivery dialog target.
 */
export function useReceiptDeliveryPreview({
  adapter,
  displayedQueueDetail,
  workspace,
}: {
  adapter: ReturnType<typeof createCashierTransactionAdapter>;
  displayedQueueDetail: Sale | null;
  workspace: { locale: string };
}) {
  const [receiptDeliveryTarget, setReceiptDeliveryTarget] = useState<ReceiptDeliveryTarget | null>(
    null,
  );
  const operationalAccessQuery = useOperationalAccessContext();
  const receiptLocation = displayedQueueDetail
    ? resolveReceiptLocation(
        displayedQueueDetail.sellingLocationId,
        operationalAccessQuery.data?.locations ?? [],
      )
    : null;
  // Same cache entry as the receipt-delivery dialog: preview and dialog always show one state.
  const receiptDeliveryStatusQuery = useQuery({
    queryKey: receiptDeliveryStatusKey(displayedQueueDetail?.id ?? null),
    queryFn: () => adapter.getReceiptDeliveryStatus(displayedQueueDetail!.id),
    enabled: Boolean(displayedQueueDetail?.status === 'FINALIZED'),
    refetchInterval: (query) =>
      receiptDeliveryPhase(query.state.data?.delivery?.status) === 'PENDING' ? 3_000 : false,
    staleTime: 1_000,
  });
  /**
   * Opens the one receipt-delivery flow for a completed transaction. Delivery is separate
   * from the transaction: sending, retrying or redirecting it never touches the Sale, its
   * customer snapshot, its payment or its queue state. Only the facts sending needs are passed;
   * the customer number only when this operator may already see it.
   */
  const openReceiptDelivery = (target: QueueSale) => {
    const customer = target.customer ?? null;
    setReceiptDeliveryTarget({
      saleId: target.id,
      reference: transactionNumber(target, workspace.locale),
      customerName: customer ? customerDisplayName(customer, workspace.locale) : null,
      customerPhone: isCompletedSaleSummary(target) ? null : (target.customer?.phoneE164 ?? null),
    });
  };
  return {
    receiptDeliveryTarget,
    setReceiptDeliveryTarget,
    receiptLocation,
    receiptDeliveryStatusQuery,
    openReceiptDelivery,
  };
}
