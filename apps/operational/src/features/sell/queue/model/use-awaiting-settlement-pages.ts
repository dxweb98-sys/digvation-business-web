import { useState } from 'react';
import type {
  OperationalProjectionQuery,
  OperationalQueuePage,
} from '../../transaction/api/operational-projection-client';
import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { awaitsSettlement } from '../../transaction/model/sale-lifecycle';

/** One request never asks Runtime for more than this. */
export const AWAITING_SETTLEMENT_PAGE_SIZE = 50;

/**
 * Sales awaiting settlement at the selected location beyond the queue's first page, loaded one
 * bounded page at a time when the cashier asks. Runtime lists them newest first, so the next page
 * starts after the ones already shown. Loaded pages are dropped whenever the location's total
 * changes (a Sale was settled, cancelled or added): the queue's first page is authoritative again.
 */
export function useAwaitingSettlementPages({
  adapter,
  queue,
  locationId,
}: {
  adapter: OperationalProjectionQuery;
  queue: OperationalQueuePage | undefined;
  locationId: string;
}) {
  const total = queue?.awaitingSettlementTotals?.[locationId] ?? 0;
  const key = `${locationId}:${total}`;
  const [loaded, setLoaded] = useState<{ key: string; items: Sale[] }>({ key, items: [] });
  const [isLoading, setIsLoading] = useState(false);
  const shownIds = new Set(
    (queue?.items ?? [])
      .filter((record) => record.sellingLocationId === locationId && awaitsSettlement(record))
      .map((record) => record.id),
  );
  const extra = (loaded.key === key ? loaded.items : []).filter((sale) => !shownIds.has(sale.id));
  const remaining = Math.max(0, total - shownIds.size - extra.length);
  const listPage = adapter.listAwaitingSettlement;

  const loadMore = async () => {
    if (!listPage || isLoading || remaining === 0) return;
    setIsLoading(true);
    try {
      const page = await listPage({
        sellingLocationId: locationId,
        offset: shownIds.size + extra.length,
        limit: AWAITING_SETTLEMENT_PAGE_SIZE,
      });
      const known = new Set([...shownIds, ...extra.map((sale) => sale.id)]);
      setLoaded({
        key,
        items: [...extra, ...page.items.filter((sale) => !known.has(sale.id))],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    items: extra,
    remaining,
    isLoading,
    loadMore: listPage ? loadMore : null,
  };
}
