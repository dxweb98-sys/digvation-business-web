import { useMemo } from 'react';
import { queueStatus } from './queue-status';
import { awaitsSettlement } from '../transaction/model/sale-lifecycle';
import type { UseQueryResult } from '@tanstack/react-query';
import type { OperationalQueuePage } from '../transaction/api/operational-projection-client';
import type { QueuedSaleEntry } from './queued-sale-storage';
import type { Sale } from '../transaction/model/cashier-transaction.types';

/**
 * Queue board records of the selected location, grouped by queue status (local demo keeps only its
 * own sales). A Sale awaiting settlement is not work, but it is listed with the queued ones so its
 * balance can be collected later.
 */
export function useQueueGroups({
  transactionsQuery,
  isLocalDemo,
  queuedSaleEntries,
  workspace,
  awaitingSettlementPages = [],
}: {
  transactionsQuery: UseQueryResult<OperationalQueuePage, Error>;
  isLocalDemo: boolean;
  queuedSaleEntries: QueuedSaleEntry[];
  workspace: { selectedLocationId: string };
  /** Further Sales awaiting settlement the cashier loaded beyond the queue's first page. */
  awaitingSettlementPages?: readonly Sale[];
}) {
  const groups = useMemo(() => {
    const locationRecords = [
      ...(transactionsQuery.data?.items ?? []),
      ...awaitingSettlementPages,
    ].filter((record) => record.sellingLocationId === workspace.selectedLocationId);
    const records = isLocalDemo
      ? locationRecords.filter((record) =>
          queuedSaleEntries.some(
            (entry) => entry.saleId === record.id && entry.saleCreatedAt === record.createdAt,
          ),
        )
      : locationRecords;
    return {
      QUEUED: records.filter(
        (record) => queueStatus(record) === 'QUEUED' || awaitsSettlement(record),
      ),
      PROGRESS: records.filter((record) => queueStatus(record) === 'PROGRESS'),
      COMPLETED: records.filter((record) => queueStatus(record) === 'COMPLETED'),
      CANCELED: records.filter((record) => queueStatus(record) === 'CANCELED'),
    };
  }, [
    awaitingSettlementPages,
    isLocalDemo,
    queuedSaleEntries,
    transactionsQuery.data,
    workspace.selectedLocationId,
  ]);
  return { groups };
}
