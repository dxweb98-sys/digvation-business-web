import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../../shared/api/build-query-string';
import type { FinancialAccount, Page, SellingLocation } from '../../financial-accounts';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExpenseOrigin = 'BACKOFFICE' | 'OPERATIONAL';
export type ExpenseSourceAccountType = 'CASH' | 'BANK' | 'E_WALLET';

export interface ExpenseActor {
  id: string;
  kind: string;
  displayName: string | null;
}

export interface Expense {
  id: string;
  sellingLocationId: string;
  sellingLocationName: string;
  financialAccountId: string;
  financialAccountName: string;
  financialAccountType: ExpenseSourceAccountType;
  origin: ExpenseOrigin;
  categoryCode: string;
  status: ExpenseStatus;
  currency: string;
  amount: string;
  note: string | null;
  occurredAt: string;
  version: number;
  createdByActorId: string;
  createdBy: ExpenseActor | null;
  approvedAt: string | null;
  approvedByActorId: string | null;
  approvedBy: ExpenseActor | null;
  rejectedAt: string | null;
  rejectedByActorId: string | null;
  rejectedBy: ExpenseActor | null;
  rejectionNote: string | null;
}

interface CountedPage<T> extends Page<T> {
  total: number;
}

export interface ExpenseQuery {
  q?: string;
  status?: ExpenseStatus;
  sellingLocationId?: string;
  financialAccountId?: string;
  categoryCode?: string;
  limit: number;
  offset: number;
}

export interface ExpenseInput {
  sellingLocationId: string;
  financialAccountId: string;
  categoryCode: string;
  amount: string;
  note: string | null;
  occurredAt: string;
}

export class ExpenseApi {
  constructor(private readonly client: ApiClient) {}

  list(query: ExpenseQuery) {
    return this.client.get<CountedPage<Expense>>(`/api/v1/expenses?${buildQueryString(query)}`);
  }
  create(input: ExpenseInput) {
    return this.client.post<Expense>('/api/v1/expenses', input);
  }
  update(item: Expense, input: ExpenseInput) {
    return this.client.patch<Expense>(`/api/v1/expenses/${item.id}`, {
      ...input,
      expectedVersion: item.version,
    });
  }
  approve(item: Expense) {
    return this.client.post<Expense>(`/api/v1/expenses/${item.id}/approve`, {
      expectedVersion: item.version,
    });
  }
  reject(item: Expense, note: string) {
    return this.client.post<Expense>(`/api/v1/expenses/${item.id}/reject`, {
      expectedVersion: item.version,
      note,
    });
  }

  /** Selling locations of every status; the editor offers only the active ones. */
  listLocations() {
    return this.client.get<Page<SellingLocation>>(
      `/api/v1/locations?${buildQueryString({ limit: 100, offset: 0 })}`,
    );
  }
  /** Financial accounts of every status, so historical expense sources stay filterable. */
  listFilterAccounts() {
    return this.client.get<Page<FinancialAccount>>(
      `/api/v1/financial-accounts?${buildQueryString({ limit: 100, offset: 0 })}`,
    );
  }
  /** Active financial accounts offered as the expense source. */
  listSourceAccounts() {
    return this.client.get<Page<FinancialAccount>>(
      `/api/v1/financial-accounts?${buildQueryString({ status: 'ACTIVE', limit: 100, offset: 0 })}`,
    );
  }
}
