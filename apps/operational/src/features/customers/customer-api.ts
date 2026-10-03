import type { ApiClient } from '@digvation/business-api';
import type { MemberTransaction } from '../../modules/membership/operational-members-api';

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
  membership?: CustomerMembership | null;
}
export interface CustomerDetail {
  customer: Customer;
  membership?: CustomerMembership | null;
  recentTransactions: MemberTransaction[];
  transactionTotal: number;
}
export const CUSTOMER_PAGE_SIZE = 20;
export class OperationalCustomersApi {
  constructor(private readonly client: ApiClient) {}
  list(input: { q?: string; type?: 'REGULAR' | 'MEMBER'; offset: number }, signal?: AbortSignal) {
    const params = new URLSearchParams({
      limit: String(CUSTOMER_PAGE_SIZE),
      offset: String(input.offset),
    });
    if (input.q) params.set('q', input.q);
    if (input.type) params.set('type', input.type);
    return this.client.get<{ items: Customer[]; total: number }>(`/api/v1/customers?${params}`, {
      signal,
    });
  }
  detail(id: string, signal?: AbortSignal) {
    return this.client.get<CustomerDetail>(`/api/v1/customers/${id}/detail`, { signal });
  }
  update(customer: Customer, input: { name: string; phone: string }) {
    return this.client.patch<Customer>(`/api/v1/customers/${customer.id}`, {
      expectedVersion: customer.version,
      name: input.name.trim(),
      phone: input.phone.trim(),
    });
  }
}
