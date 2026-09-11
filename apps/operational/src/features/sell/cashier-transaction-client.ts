import { ApiClient } from '@digvation/pos-api';

import type {
  EmployeeQuery,
  OpenSalesQuery,
  SaleTransactionClient,
  SellingCatalogQuery,
} from './cashier-transaction.adapter';
import { HttpCashierTransactionAdapter } from './cashier-transaction.adapter';
import { getLocalDemoCashierTransactionAdapter } from './local-demo-cashier-transaction.adapter';

export type CashierTransactionAdapter = SellingCatalogQuery &
  EmployeeQuery &
  OpenSalesQuery &
  SaleTransactionClient;

export function isCashierDemoMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_CASHIER_DATA_SOURCE === 'demo';
}

export function createCashierTransactionAdapter(apiBaseUrl: string): CashierTransactionAdapter {
  if (isCashierDemoMode()) return getLocalDemoCashierTransactionAdapter();
  return new HttpCashierTransactionAdapter(new ApiClient({ baseUrl: apiBaseUrl }));
}
