import { useState } from 'react';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { hasSuccessfulPayment } from '../payment/sale-payment-status';
import { workflowIssues } from './workflow-issues';
import { transactionNumber } from '../transaction/model/sale-display';
import type { Dispatch, SetStateAction } from 'react';
import type { useToast } from '@digvation-labs/ui';
import type { QueueStatus } from './queue-status';

/**
 * Completing queued work: confirmation, finalize, and the immediate receipt rule (detail when the
 * operator may read completed Sales or it was paid; receipt id only when paid).
 */
export function useQueuedSaleCompletion({
  workspace,
  canReadCompleted,
  setQueueTab,
  setQueueDetail,
  setReceiptSaleId,
  showToast,
  copy,
}: {
  workspace: { locale: string; finalizeQueuedSale: (sale: Sale) => Promise<Sale> };
  canReadCompleted: boolean;
  setQueueTab: Dispatch<SetStateAction<QueueStatus>>;
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  setReceiptSaleId: Dispatch<SetStateAction<string | null>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const [completionConfirmationTarget, setCompletionConfirmationTarget] = useState<Sale | null>(
    null,
  );
  const completeQueuedTransaction = (transaction: Sale) => {
    const issues = workflowIssues(transaction, workspace.locale);
    if (issues.length) return;
    setCompletionConfirmationTarget(transaction);
  };
  const confirmQueuedCompletion = async () => {
    if (
      !completionConfirmationTarget ||
      workflowIssues(completionConfirmationTarget, workspace.locale).length
    ) {
      return;
    }
    try {
      // The finalize response is the immediate completion result, so its receipt
      // is shown to every operator who completed it. Without sales:read-completed
      // it opens as the receipt only (no detail) and is gone once closed: later
      // reads of the completed transaction are history, which Runtime forbids.
      const finalized = await workspace.finalizeQueuedSale(completionConfirmationTarget);
      setQueueTab('COMPLETED');
      const paid = hasSuccessfulPayment(finalized);
      if (canReadCompleted || paid) {
        setQueueDetail(finalized);
        setReceiptSaleId(paid ? finalized.id : null);
      } else {
        setQueueDetail(null);
        setReceiptSaleId(null);
      }
      setCompletionConfirmationTarget(null);
      showToast({
        title: copy('Transaction completed'),
        description: `${transactionNumber(finalized, workspace.locale)} ${copy('has been completed.')}`,
        variant: 'success',
      });
    } catch {
      showToast({
        title: copy('Could not complete transaction'),
        description: copy('Check the transaction status and try again.'),
        variant: 'danger',
      });
    }
  };
  return {
    completionConfirmationTarget,
    setCompletionConfirmationTarget,
    completeQueuedTransaction,
    confirmQueuedCompletion,
  };
}
