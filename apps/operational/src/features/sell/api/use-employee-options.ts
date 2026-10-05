import { useQuery } from '@tanstack/react-query';

import { referenceQueryPolicy } from '../../../app/data/operational-cache-policy';
import type { EmployeeQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';

/**
 * Effective Service performers, exactly as Runtime returns them (canPerformServices). The list is
 * reference data, but Workforce changes happen in Backoffice where this app's cache cannot be
 * invalidated, so `refresh` re-reads it whenever a performer picker opens.
 */
export function useEmployeeOptions(query: EmployeeQuery, enabled: boolean) {
  const performersQuery = useQuery({
    queryKey: cashierTransactionKeys.servicePerformers(),
    queryFn: ({ signal }) => query.listServicePerformers(signal),
    ...referenceQueryPolicy,
    enabled,
  });

  return {
    employees: performersQuery.data?.items ?? [],
    isLoading: performersQuery.isLoading,
    error: performersQuery.error,
    refresh: () => {
      if (enabled) void performersQuery.refetch();
    },
  };
}
