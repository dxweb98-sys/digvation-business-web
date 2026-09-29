import type { ApiClient } from '@digvation/business-api';

export type WorkshopBillingValidationState = 'DRAFT' | 'VALIDATED' | 'REVALIDATION_REQUIRED';

/**
 * The current billing draft of a Work Order exactly as Runtime calculated it
 * from the effective items and the Business tax. Amounts are decimal strings.
 */
export interface WorkshopBilling {
  workOrderId: string;
  currency: string;
  subtotalAmount: string;
  tax: {
    enabled: boolean;
    /** Decimal fraction: "0.11" is 11%. Meaningful only when enabled. */
    rate: string;
    treatment: 'EXCLUDED';
    amount: string;
  };
  totalAmount: string;
  validationState: WorkshopBillingValidationState;
  sourceWorkOrderVersion: number;
  version: number;
  lastValidatedAt: string | null;
}

/** Thin transport for the billing draft. Nothing is calculated in the browser. */
export class WorkshopBillingApi {
  constructor(private readonly client: ApiClient) {}

  getBilling(workOrderId: string) {
    return this.client.get<WorkshopBilling>(`/api/v1/workshop/work-orders/${workOrderId}/billing`);
  }

  /** Only the reviewed billing version is sent; Runtime recomputes every amount. */
  validateBilling(workOrderId: string, expectedVersion: number) {
    return this.client.post<WorkshopBilling>(
      `/api/v1/workshop/work-orders/${workOrderId}/billing/validate`,
      { expectedVersion },
    );
  }
}
