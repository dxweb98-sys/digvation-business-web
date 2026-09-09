import { ApiClient } from '@digvation/pos-api';
import type { RuntimeConfig } from '@digvation/pos-runtime';

import {
  HttpCashierTransactionAdapter,
  type SaleTransactionPort,
} from './cashier-transaction.adapter';
import { LocalCashierTransactionAdapter } from './local-cashier-transaction.adapter';

let localDemoAdapter: LocalCashierTransactionAdapter | null = null;

export function isLocalCashierDemoEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_CASHIER_DEMO === 'true';
}

/** Selects the transaction boundary once; Cashier presentation never selects a transport. */
export function createCashierTransactionAdapter(
  runtime: RuntimeConfig,
  getAccessToken?: () => Promise<string | null>,
): SaleTransactionPort {
  if (isLocalCashierDemoEnabled()) {
    localDemoAdapter ??= new LocalCashierTransactionAdapter();
    return localDemoAdapter;
  }
  return new HttpCashierTransactionAdapter(
    new ApiClient({
      baseUrl: runtime.apiBaseUrl,
      ...(getAccessToken ? { getAccessToken } : {}),
    }),
  );
}
