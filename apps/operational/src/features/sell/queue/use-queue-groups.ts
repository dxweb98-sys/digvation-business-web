import { useMemo } from 'react';
import { queueStatus } from './queue-status';
import type { UseQueryResult } from '@tanstack/react-query';
import type { OperationalQueuePage } from '../transaction/api/operational-projection-client';
import type { QueuedSaleEntry } from './queued-sale-storage';

/** Queue board records of the selected location, grouped by queue status (local demo keeps only its own sales). */
export function useQueueGroups({
  transactionsQuery,
  isLocalDemo,
  queuedSaleEntries,
  workspace,
}: {
  transactionsQuery: UseQueryResult<OperationalQueuePage, Error>;
  isLocalDemo: boolean;
  queuedSaleEntries: QueuedSaleEntry[];
  workspace: { selectedLocationId: string };
}) {
  const groups = useMemo(() => {
    const locationRecords = (transactionsQuery.data?.items ?? []).filter(
      (record) => record.sellingLocationId === workspace.selectedLocationId,
    );
    const records = isLocalDemo
      ? locationRecords.filter((record) =>
          queuedSaleEntries.some(
            (entry) => entry.saleId === record.id && entry.saleCreatedAt === record.createdAt,
          ),
        )
      : locationRecords;
    return {
      QUEUED: records.filter((record) => queueStatus(record) === 'QUEUED'),
      PROGRESS: records.filter((record) => queueStatus(record) === 'PROGRESS'),
      COMPLETED: records.filter((record) => queueStatus(record) === 'COMPLETED'),
      CANCELED: records.filter((record) => queueStatus(record) === 'CANCELED'),
    };
  }, [isLocalDemo, queuedSaleEntries, transactionsQuery.data, workspace.selectedLocationId]);
  return { groups };
}
