import { useQuery } from '@tanstack/react-query';

import { referenceQueryPolicy } from '../../app/data/operational-cache-policy';
import type { EmployeeQuery } from './cashier-transaction.adapter';
import { cashierTransactionKeys } from './cashier-transaction-keys';
import type { Employee } from './cashier-transaction.types';

export function selectableServicePerformers(
  employees: readonly Employee[],
): Employee[] {
  return employees.filter((employee) => employee.canPerformServices);
}

export function useEmployeeOptions(query: EmployeeQuery, enabled: boolean) {
  const employeesQuery = useQuery({
    queryKey: cashierTransactionKeys.employees(),
    queryFn: ({ signal }) => query.listEmployees(signal),
    ...referenceQueryPolicy,
    enabled,
  });

  return {
    employees: selectableServicePerformers(employeesQuery.data?.items ?? []),
    isLoading: employeesQuery.isLoading,
    error: employeesQuery.error,
  };
}
