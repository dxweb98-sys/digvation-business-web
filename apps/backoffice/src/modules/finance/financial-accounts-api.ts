import type { ApiClient } from '@digvation/business-api';

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type FinancialAccountType = 'CASH' | 'BANK' | 'E_WALLET';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
}
interface FinancialAccountPage<T> extends Page<T> {
  total: number;
}

export interface FinancialAccount {
  id: string;
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

type Query = Record<string, string | number | undefined>;
const queryString = (query: Query) =>
  new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [
      string,
      string,
    ][],
  ).toString();

export class FinancialAccountsApi {
  public constructor(private readonly client: ApiClient) {}

  listAccounts(query: Query) {
    return this.client.get<FinancialAccountPage<FinancialAccount>>(
      `/api/v1/financial-accounts?${queryString(query)}`,
    );
  }
  getAccount(id: string) {
    return this.client.get<FinancialAccount>(`/api/v1/financial-accounts/${id}`);
  }
  createAccount(
    input: Omit<FinancialAccount, 'id' | 'status' | 'version' | 'createdAt' | 'updatedAt'>,
  ) {
    return this.client.post<FinancialAccount>('/api/v1/financial-accounts', input);
  }
  updateAccount(
    account: FinancialAccount,
    input: Partial<
      Pick<
        FinancialAccount,
        'name' | 'institutionName' | 'accountReference' | 'accountHolderName' | 'status'
      >
    >,
  ) {
    return this.client.patch<FinancialAccount>(`/api/v1/financial-accounts/${account.id}`, {
      expectedVersion: account.version,
      ...input,
    });
  }

  listRoutes(query: Query) {
    return this.client.get<FinancialAccountPage<PaymentRoute>>(`/api/v1/payment-routing?${queryString(query)}`);
  }
  getRoute(id: string) {
    return this.client.get<PaymentRoute>(`/api/v1/payment-routing/${id}`);
  }
  createRoute(input: {
    sellingLocationId: string;
    paymentMethod: PaymentMethod;
    financialAccountId: string;
  }) {
    return this.client.post<PaymentRoute>('/api/v1/payment-routing', input);
  }
  updateRoute(route: PaymentRoute, input: { financialAccountId?: string; status?: RecordStatus }) {
    return this.client.patch<PaymentRoute>(`/api/v1/payment-routing/${route.id}`, {
      expectedVersion: route.version,
      ...input,
    });
  }

  listLocations(limit: number, offset: number) {
    return this.client.get<Page<SellingLocation>>(
      `/api/v1/locations?limit=${limit}&offset=${offset}`,
    );
  }
}
