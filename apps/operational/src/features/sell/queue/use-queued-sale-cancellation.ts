import { useState } from 'react';
import { cashierTransactionErrorMessage } from '../transaction/api/cashier-transaction-errors';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { readCancellationReasons, writeCancellationReason } from './queued-sale-storage';
import { financialSummary } from '../payment/sale-payment-status';
import { money, isPositiveDecimal } from '../transaction/model/sale-display';
import type { Dispatch, SetStateAction } from 'react';
import type { useToast } from '@digvation-labs/ui';
import type { QueueStatus } from './queue-status';
import type { RefundDisbursementInput } from '../transaction/api/cashier-transaction.adapter';
import type { PaymentRoute } from '../transaction/model/cashier-transaction.types';
import {
  defaultRefundDisbursement,
  refundDisbursementInput,
  type RefundDisbursementDraft,
} from '../adjustment/refund-disbursement-picker';

/** Cancelling (voiding) a queued Sale with a required reason; local demo keeps the reasons. */
export function useQueuedSaleCancellation({
  workspace,
  isLocalDemo,
  setQueueDetail,
  setQueueTab,
  setReceiptSaleId,
  showToast,
  copy,
}: {
  workspace: {
    locale: string;
    voidQueuedSale: (
      targetSale: Sale,
      refundDisbursement?: RefundDisbursementInput,
    ) => Promise<Sale>;
    closeQueueContext: () => void;
    paymentRoutes: readonly PaymentRoute[];
  };
  isLocalDemo: boolean;
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  setQueueTab: Dispatch<SetStateAction<QueueStatus>>;
  setReceiptSaleId: Dispatch<SetStateAction<string | null>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  // How a paid Sale's money is returned; until changed, the first available account.
  const [disbursementChoice, setDisbursement] = useState<RefundDisbursementDraft | null>(null);
  const disbursement = disbursementChoice ?? defaultRefundDisbursement(workspace.paymentRoutes);
  const [cancellationReasons, setCancellationReasons] = useState<Record<string, string>>(() =>
    isLocalDemo ? readCancellationReasons() : {},
  );
  const requestCancel = (transaction: Sale) => {
    setCancelTarget(transaction);
    setCancelReason('');
    setDisbursement(null);
  };
  const confirmCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const refundAmount = financialSummary(cancelTarget).totalPaid;
    const refunds = isPositiveDecimal(refundAmount);
    if (refunds && !disbursement) return;
    try {
      const canceledSale = await workspace.voidQueuedSale(
        cancelTarget,
        refunds && disbursement ? refundDisbursementInput(disbursement) : undefined,
      );
      if (isLocalDemo) {
        writeCancellationReason(canceledSale.id, cancelReason.trim());
        setCancellationReasons((current) => ({
          ...current,
          [canceledSale.id]: cancelReason.trim(),
        }));
      }
      setQueueDetail(canceledSale);
      setQueueTab('CANCELED');
      setReceiptSaleId(null);
      setCancelTarget(null);
      setCancelReason('');
      workspace.closeQueueContext();
      showToast({
        title: copy('Transaction canceled'),
        description: refunds
          ? `${copy('Refund recorded')}: ${money(refundAmount, workspace.locale)}. ${copy('Cancellation reason saved.')}`
          : copy('Cancellation reason saved.'),
        variant: 'success',
      });
    } catch (error) {
      showToast({
        title: copy('Cancellation failed'),
        description: cashierTransactionErrorMessage(error),
        variant: 'danger',
      });
    }
  };
  return {
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    disbursement,
    setDisbursement,
    cancellationReasons,
    requestCancel,
    confirmCancel,
  };
}
