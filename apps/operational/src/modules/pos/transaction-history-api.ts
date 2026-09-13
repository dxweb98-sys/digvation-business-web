import type { ApiClient } from '@digvation/business-api';

export type SaleStatus = 'OPEN' | 'FINALIZED' | 'VOIDED';
export interface OperationalSale {
  id: string;
  saleNumber: string;
  invoiceNumber: string | null;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  totalAmount: string;
  createdAt: string;
  finalizedAt: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

type Query = Record<string, string | number | undefined>;
const queryString = (query: Query) =>
  new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [
      string,
      string,
    ][],
  ).toString();

export class OperationalTransactionHistoryApi {
  constructor(private readonly client: ApiClient) {}

  list(query: Query) {
    return this.client.get<Page<OperationalSale>>(
      `/api/v1/sales?${queryString(query)}`,
    );
  }

  get(id: string) {
    return this.client.get<OperationalSale>(`/api/v1/sales/${id}`);
  }
}
