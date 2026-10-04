import type { ApiClient } from '@digvation/business-api';
import { buildQueryString } from '../../../shared/api/build-query-string';

export interface CustomerMembership {
  id: string;
  memberNumber: string;
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
}
export interface Customer {
  id: string;
  name: string;
  phoneE164: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Omitted when Membership facts are not authorized. */
  membership?: CustomerMembership | null;
}
export interface CustomerTransaction {
  saleId: string;
  saleNumber: string | null;
  currency: string;
  totalAmount: string;
  finalizedAt: string;
}
export interface CustomerDetail {
  customer: Customer;
  membership?: CustomerMembership | null;
  recentTransactions: CustomerTransaction[];
  transactionTotal: number;
}
export class CustomersApi {
  constructor(private readonly client: ApiClient) {}
  list(query: { q?: string; status?: Customer['status']; limit: number; offset: number }) {
    return this.client.get<{ items: Customer[]; total: number; limit: number; offset: number }>(
      `/api/v1/customers?${buildQueryString(query)}`,
    );
  }
  detail(id: string) {
    return this.client.get<CustomerDetail>(`/api/v1/customers/${id}/detail`);
  }
  update(customer: Customer, input: { name: string; phone: string }) {
    return this.client.patch<Customer>(`/api/v1/customers/${customer.id}`, {
      expectedVersion: customer.version,
      ...input,
    });
  }
}
