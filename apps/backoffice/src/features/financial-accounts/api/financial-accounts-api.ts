import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../../shared/api/build-query-string';

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type FinancialAccountType = 'CASH' | 'BANK' | 'E_WALLET' | 'QRIS';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
}
interface CountedPage<T> extends Page<T> {
  total: number;
}

export interface FinancialAccount {
  id: string;
  /** Legacy accounts created before Runtime generated codes may have none. */
  code: string | null;
  name: string;
  type: FinancialAccountType;
  currency: string;
  institutionName: string | null;
  accountReference: string | null;
  accountHolderName: string | null;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRoute {
  id: string;
  sellingLocationId: string;
  sellingLocationCode: string;
  sellingLocationName: string;
  paymentMethod: PaymentMethod;
  currency: string;
  financialAccountId: string;
  financialAccountCode: string | null;
  financialAccountName: string;
  financialAccountType: FinancialAccountType;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SellingLocation {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  version: number;
}

export interface FinancialAccountQuery {
  q?: string;
  type?: FinancialAccountType;
  status?: RecordStatus;
  limit: number;
  offset: number;
}

export interface PaymentRouteQuery {
  sellingLocationId?: string;
  paymentMethod?: PaymentMethod;
  status?: RecordStatus;
  limit: number;
  offset: number;
}

export interface CreateFinancialAccountInput {
  /** Omitted when Runtime should generate the tenant account code. */
  code?: string;
  name: string;
  type: FinancialAccountType;
  currency: string;
  institutionName: string | null;
  accountReference: string | null;
  accountHolderName: string | null;
}

export type UpdateFinancialAccountInput = Partial<
  Pick<
    FinancialAccount,
    'name' | 'institutionName' | 'accountReference' | 'accountHolderName' | 'status'
  >
>;

export interface CreatePaymentRouteInput {
  sellingLocationId: string;
  paymentMethod: PaymentMethod;
  financialAccountId: string;
}

export interface UpdatePaymentRouteInput {
  financialAccountId?: string;
  status?: RecordStatus;
}

export class FinancialAccountsApi {
  public constructor(private readonly client: ApiClient) {}

  listAccounts(query: FinancialAccountQuery) {
    return this.client.get<CountedPage<FinancialAccount>>(
      `/api/v1/financial-accounts?${buildQueryString(query)}`,
    );
  }
  createAccount(input: CreateFinancialAccountInput) {
    return this.client.post<FinancialAccount>('/api/v1/financial-accounts', input);
  }
  updateAccount(account: FinancialAccount, input: UpdateFinancialAccountInput) {
    return this.client.patch<FinancialAccount>(`/api/v1/financial-accounts/${account.id}`, {
      expectedVersion: account.version,
      ...input,
    });
  }

  listRoutes(query: PaymentRouteQuery) {
    return this.client.get<CountedPage<PaymentRoute>>(
      `/api/v1/payment-routing?${buildQueryString(query)}`,
    );
  }
  createRoute(input: CreatePaymentRouteInput) {
    return this.client.post<PaymentRoute>('/api/v1/payment-routing', input);
  }
  updateRoute(route: PaymentRoute, input: UpdatePaymentRouteInput) {
    return this.client.patch<PaymentRoute>(`/api/v1/payment-routing/${route.id}`, {
      expectedVersion: route.version,
      ...input,
    });
  }

  listLocations(limit: number, offset: number) {
    return this.client.get<Page<SellingLocation>>(
      `/api/v1/locations?${buildQueryString({ limit, offset })}`,
    );
  }
}
