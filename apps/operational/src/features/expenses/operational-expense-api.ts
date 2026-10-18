import type { ApiClient } from '@digvation/business-api';

export interface OperationalExpense {
  id: string;
  sellingLocationId: string;
  sellingLocationName: string;
  financialAccountId: string;
  financialAccountName: string;
  origin: 'OPERATIONAL';
  categoryCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  currency: string;
  amount: string;
  note: string | null;
  occurredAt: string;
}

export interface FinancialAccountOption {
  id: string;
  name: string;
  code: string | null;
  type: 'CASH' | 'BANK' | 'E_WALLET';
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  operatingLocationId: string | null;
}

interface Page<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

type Query = Record<string, string | number | undefined>;
const queryString = (query: Query) =>
  new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [
      string,
      string,
    ][],
  ).toString();

export class OperationalExpenseApi {
  constructor(private readonly client: ApiClient) {}

  list(query: Query) {
    return this.client.get<Page<OperationalExpense>>(
      `/api/v1/operational/expenses?${queryString(query)}`,
    );
  }

  create(input: {
    sellingLocationId: string;
    financialAccountId: string;
    categoryCode: string;
    amount: string;
    occurredAt: string;
    note?: string | null;
  }) {
    return this.client.post<OperationalExpense>('/api/v1/operational/expenses', input);
  }

  listEligibleAccounts(sellingLocationId: string) {
    return this.client.get<Page<FinancialAccountOption>>(
      `/api/v1/operational/expenses/eligible-accounts?sellingLocationId=${encodeURIComponent(sellingLocationId)}`,
    );
  }
}
