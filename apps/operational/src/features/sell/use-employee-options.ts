import { useQuery } from '@tanstack/react-query';

import type { EmployeeQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';

export function useEmployeeOptions(query: EmployeeQuery, enabled: boolean) {
  const employeesQuery = useQuery({
    queryKey: cashierTransactionKeys.employees(),
    queryFn: ({ signal }) => query.listEmployees(signal),
    staleTime: 180_000,
    enabled,
  });

  return {
    employees: (employeesQuery.data?.items ?? []).filter(
      (employee) => employee.status === 'ACTIVE',
    ),
    isLoading: employeesQuery.isLoading,
    error: employeesQuery.error,
  };
}
