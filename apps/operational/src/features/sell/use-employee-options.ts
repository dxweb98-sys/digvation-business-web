import { useQuery } from '@tanstack/react-query';

import type { EmployeeQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';

export function useEmployeeOptions(query: EmployeeQuery) {
  const employeesQuery = useQuery({
    queryKey: cashierTransactionKeys.employees(),
    queryFn: ({ signal }) => query.listEmployees(signal),
    staleTime: 30_000,
  });

  return {
    employees: (employeesQuery.data?.items ?? []).filter(
      (employee) => employee.status === 'ACTIVE',
    ),
    isLoading: employeesQuery.isLoading,
    error: employeesQuery.error,
  };
}
