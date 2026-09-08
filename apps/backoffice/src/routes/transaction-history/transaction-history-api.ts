import type { ApiClient } from '@digvation/pos-api';

export type SaleStatus = 'OPEN' | 'FINALIZED' | 'VOIDED';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type FulfillmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export interface Payment {
  id: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';
  status: PaymentStatus;
  currency: string;
  appliedAmount: string;
  tenderedAmount: string | null;
  changeAmount: string | null;
  providerReference: string | null;
  terminalAt: string | null;
  createdAt: string;
}

export interface SaleLine {
  id: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: string;
  netPreTaxAmount: string;
  fulfillmentBehaviorSnapshot: 'INSTANT' | 'TRACKED';
  fulfillment: { status: FulfillmentStatus; startedAt: string | null; completedAt: string | null; canceledAt: string | null } | null;
}

export interface Sale {
  id: string;
  saleNumber: string;
  invoiceNumber: string | null;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  totalAmount: string;
  taxAmount: string;
  discountAmount: string;
  createdAt: string;
  finalizedAt: string | null;
  voidedAt: string | null;
  lines: SaleLine[];
  payments: Payment[];
}

interface Page<T> { items: T[]; total: number; limit: number; offset: number; }
type Query = Record<string, string | number | undefined>;
const queryString = (query: Query) => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [string, string][]).toString();

export class TransactionHistoryApi {
  constructor(private readonly client: ApiClient) {}

  list(query: Query) { return this.client.get<Page<Sale>>(`/api/v1/sales?${queryString(query)}`); }
  get(id: string) { return this.client.get<Sale>(`/api/v1/sales/${id}`); }
}
