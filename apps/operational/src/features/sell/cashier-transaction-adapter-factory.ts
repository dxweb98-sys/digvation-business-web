import { ApiClient } from '@digvation/business-api';
import type { RuntimeConfig } from '@digvation/business-runtime';

import {
  HttpCashierTransactionAdapter,
  type SaleTransactionPort,
} from './cashier-transaction.adapter';
import { LocalCashierTransactionAdapter } from './local-cashier-transaction.adapter';

let localDemoAdapter: LocalCashierTransactionAdapter | null = null;

type PerformerCapableTransactionPort = SaleTransactionPort & {
  setSaleLinePerformers: NonNullable<SaleTransactionPort['setSaleLinePerformers']>;
};

function withServicePerformers(adapter: SaleTransactionPort): PerformerCapableTransactionPort {
  if (!adapter.setSaleLinePerformers) {
    adapter.setSaleLinePerformers = async (saleId, saleLineId, input) => {
      const assigned = await adapter.setSaleLineAssignments(saleId, saleLineId, {
        expectedVersion: input.expectedVersion,
        employeeIds: input.performers.map((performer) => performer.employeeId),
      });
      return adapter.setSaleLineContributions(saleId, saleLineId, {
        expectedVersion: assigned.version,
        contributors: input.performers,
      });
    };
  }
  return adapter as PerformerCapableTransactionPort;
}

export function isLocalCashierDemoEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_CASHIER_DEMO === 'true';
}

/** Selects the transaction boundary once; Cashier presentation never selects a transport. */
export function createCashierTransactionAdapter(
  runtime: RuntimeConfig,
  getAccessToken?: () => Promise<string | null>,
): PerformerCapableTransactionPort {
  if (isLocalCashierDemoEnabled()) {
    localDemoAdapter ??= new LocalCashierTransactionAdapter();
    return withServicePerformers(localDemoAdapter);
  }
  return withServicePerformers(
    new HttpCashierTransactionAdapter(
      new ApiClient({
        baseUrl: runtime.apiBaseUrl,
        ...(getAccessToken ? { getAccessToken } : {}),
      }),
    ),
  );
}
