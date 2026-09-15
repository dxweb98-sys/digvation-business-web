import { ApiClient } from '@digvation/business-api';
import type { RuntimeConfig } from '@digvation/business-runtime';

import {
  HttpCashierTransactionAdapter,
  type SaleTransactionPort,
} from './cashier-transaction.adapter';
import { LocalCashierTransactionAdapter } from './local-cashier-transaction.adapter';
import {
  attachOperationalProjection,
  type OperationalProjectionQuery,
} from './operational-projection-client';

let localDemoAdapter: LocalCashierTransactionAdapter | null = null;

type PerformerCapableTransactionPort = SaleTransactionPort & {
  setSaleLinePerformers: NonNullable<SaleTransactionPort['setSaleLinePerformers']>;
};
type OperationalCashierTransactionPort = PerformerCapableTransactionPort & OperationalProjectionQuery;

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
): OperationalCashierTransactionPort {
  if (isLocalCashierDemoEnabled()) {
    localDemoAdapter ??= new LocalCashierTransactionAdapter();
    return withServicePerformers(localDemoAdapter) as OperationalCashierTransactionPort;
  }

  const client = new ApiClient({
    baseUrl: runtime.apiBaseUrl,
    applicationSurface: 'operational',
    ...(getAccessToken ? { getAccessToken } : {}),
  });
  const adapter = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));
  return withServicePerformers(adapter) as OperationalCashierTransactionPort;
}
