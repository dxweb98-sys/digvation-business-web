import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type {
  OrderAdjustmentInput,
  OrderAdjustmentPreview,
} from '../transaction/api/cashier-transaction.adapter';
import { cashierTransactionKeys } from '../transaction/api/cashier-transaction-keys';

export type PreviewOrderAdjustment = (
  saleId: string,
  input: OrderAdjustmentInput,
  signal?: AbortSignal,
) => Promise<OrderAdjustmentPreview>;

/**
 * Runtime's read-only impact of the adjustment draft, the only source of its money.
 *
 * - Each exact draft is its own query and a superseded request is aborted, so a late answer for an
 *   older draft can never be shown for the current one.
 * - While the next answer is on its way the last one stays on screen: the impact never blanks or
 *   drops to Rp 0 between drafts.
 * - Saving needs the answer for exactly the current draft (`current`), never the one still shown
 *   from before; a failed preview leaves nothing to save until it is calculated again.
 */
export function useOrderAdjustmentPreview({
  preview,
  saleId,
  input,
}: {
  preview: PreviewOrderAdjustment;
  saleId: string;
  input: OrderAdjustmentInput | null;
}) {
  const query = useQuery({
    queryKey: cashierTransactionKeys.orderAdjustmentPreview(saleId, input),
    queryFn: ({ signal }) => preview(saleId, input!, signal),
    enabled: input !== null,
    staleTime: 15_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [shown, setShown] = useState<OrderAdjustmentPreview | null>(null);
  const latest = input === null ? null : (query.data ?? shown);
  if (latest !== shown) setShown(latest);
  return {
    /** What to display: the answer for this draft, or the last one while it is calculated. */
    shown: latest,
    /** The answer for exactly this draft; what a save acknowledges. */
    current: input === null || query.isError ? null : (query.data ?? null),
    calculating: input !== null && query.isFetching,
    failed: input !== null && query.isError,
    error: query.error,
    recalculate: () => void query.refetch(),
  };
}
