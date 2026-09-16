import { ApiClient } from '@digvation/business-api';

import {
  HttpCashierTransactionAdapter,
  type SaleTransactionPort,
} from './cashier-transaction.adapter';
import {
  attachOperationalProjection,
  type OperationalProjectionQuery,
  type OperationalPromotionCommands,
} from './operational-projection-client';

type PerformerCapableTransactionPort = SaleTransactionPort & {
  setSaleLinePerformers: NonNullable<SaleTransactionPort['setSaleLinePerformers']>;
};
type OperationalCashierTransactionPort = PerformerCapableTransactionPort &
  OperationalProjectionQuery &
  OperationalPromotionCommands;

type ApiTarget = string | { readonly apiBaseUrl: string };

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

/** Operational integration never falls back to the legacy in-memory cashier demo. */
export function isLocalCashierDemoEnabled(): boolean {
  return false;
}

/** Selects the Runtime-backed Operational transaction boundary once. */
export function createCashierTransactionAdapter(
  target: ApiTarget,
  getAccessToken?: () => Promise<string | null>,
): OperationalCashierTransactionPort {
  const apiBaseUrl = typeof target === 'string' ? target : target.apiBaseUrl;
  const client = new ApiClient({
    baseUrl: apiBaseUrl,
    applicationSurface: 'operational',
    ...(getAccessToken ? { getAccessToken } : {}),
  });
  const adapter = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));
  return withServicePerformers(adapter) as OperationalCashierTransactionPort;
}
