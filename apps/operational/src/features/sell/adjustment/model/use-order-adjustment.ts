import { useState } from 'react';
import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { canAdjustOrder } from './sale-adjustment-access';
import type { Dispatch, SetStateAction } from 'react';
import type { useToast } from '@digvation-labs/ui';

/** Adjust Order of a queued Sale: the permission-gated entry and the Sale being adjusted. */
export function useOrderAdjustment({
  workspace,
  session,
  sale,
  setQueueDetail,
  showToast,
  copy,
}: {
  workspace: { hydrateQueuedSale: (saleId: string) => Promise<Sale> };
  session: { access: { permissions: readonly string[] } };
  sale: Sale | null;
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const [adjustmentTarget, setAdjustmentTarget] = useState<Sale | null>(null);
  // Opened from Transaction detail, the detail stays open beneath and takes the saved Sale.
  const [fromDetail, setFromDetail] = useState(false);
  const displayedAdjustmentTarget =
    adjustmentTarget && sale?.id === adjustmentTarget.id ? sale : adjustmentTarget;
  const openAdjustment = async (
    transaction: Sale,
    { keepDetail = false }: { keepDetail?: boolean } = {},
  ) => {
    if (transaction.status !== 'OPEN') return;
    // Runtime enforces this too; never open a dialog that can only end in a refusal.
    if (!canAdjustOrder(transaction, session.access.permissions)) return;
    setFromDetail(keepDetail);
    if (!keepDetail) setQueueDetail(null);
    try {
      const hydrated = await workspace.hydrateQueuedSale(transaction.id);
      setAdjustmentTarget(hydrated);
    } catch {
      showToast({
        title: copy('Could not load transaction'),
        description: copy('Reload the transaction before accepting payment.'),
        variant: 'danger',
      });
    }
  };
  /** Runtime's saved Sale replaces the detail it was opened from; nothing else is assumed. */
  const adjustmentCommitted = (saved: Sale) => {
    if (fromDetail) setQueueDetail(saved);
    setFromDetail(false);
    setAdjustmentTarget(null);
  };
  return {
    setAdjustmentTarget,
    displayedAdjustmentTarget,
    openAdjustment,
    adjustmentCommitted,
  };
}
