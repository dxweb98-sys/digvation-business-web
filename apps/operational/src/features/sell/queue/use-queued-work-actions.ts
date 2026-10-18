import type { Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import { transactionNumber } from '../transaction/model/sale-display';
import type { Dispatch, SetStateAction } from 'react';
import type { useToast } from '@digvation-labs/ui';
import type { QueueStatus } from './queue-status';

/** Starting tracked work from the queue: a whole queued Sale, or one waiting Service line. */
export function useQueuedWorkActions({
  workspace,
  setQueueTab,
  setQueueDetail,
  showToast,
  copy,
}: {
  workspace: {
    locale: string;
    startSaleWork: (sale: Sale) => Promise<Sale>;
    startQueuedFulfillment: (sale: Sale, preferredLine: SaleLine) => Promise<Sale>;
    transitionQueuedFulfillment: (
      sale: Sale,
      line: SaleLine,
      status: 'COMPLETED' | 'IN_PROGRESS',
    ) => Promise<Sale>;
  };
  setQueueTab: Dispatch<SetStateAction<QueueStatus>>;
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const startQueuedWork = async (transaction: Sale) => {
    const line = transaction.lines.find(
      (candidate) =>
        candidate.removedAt === null &&
        candidate.fulfillmentBehaviorSnapshot === 'TRACKED' &&
        candidate.fulfillment?.status === 'WAITING',
    );
    if (!line) {
      showToast({
        title: copy('No work can be started'),
        description: copy('This transaction has no services waiting to be worked on.'),
        variant: 'warning',
      });
      return false;
    }
    try {
      const started =
        transaction.operationalState === 'IN_PROGRESS'
          ? transaction
          : await workspace.startSaleWork(transaction);
      await workspace.startQueuedFulfillment(started, line);
      setQueueTab('PROGRESS');
      showToast({
        title: copy('Work started'),
        description: `${transactionNumber(transaction, workspace.locale)} ${copy('is now being worked on.')}`,
        variant: 'success',
      });
      return true;
    } catch {
      showToast({
        title: copy('Could not start work'),
        description: copy('The transaction remains in the queue.'),
        variant: 'danger',
      });
      return false;
    }
  };
  /**
   * Advances a single tracked Service line from WAITING to IN_PROGRESS while the
   * transaction is already being worked on. Only this line changes; other WAITING
   * lines on the same Sale are untouched.
   */
  const startWaitingServiceLine = async (transaction: Sale, line: SaleLine) => {
    try {
      const updated = await workspace.transitionQueuedFulfillment(transaction, line, 'IN_PROGRESS');
      setQueueDetail(updated);
      showToast({
        title: copy('Work started'),
        description: `${line.itemNameSnapshot} ${copy('is now being worked on.')}`,
        variant: 'success',
      });
    } catch {
      showToast({
        title: copy('Could not start work'),
        description: copy('The service was not started. Try again.'),
        variant: 'danger',
      });
    }
  };
  return { startQueuedWork, startWaitingServiceLine };
}
