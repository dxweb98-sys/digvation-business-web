import type { WorkshopBillingValidationState } from '../api/workshop-billing-api';
import type { WorkshopWorkOrderStatus } from '../api/workshop-queue-api';

/**
 * Billing amounts are sensitive: without this permission the section is not
 * rendered at all (no amounts, no disabled action). Runtime enforces the same.
 */
export function canReadBilling(
  status: WorkshopWorkOrderStatus,
  permissions: readonly string[],
): boolean {
  return status !== 'CANCELLED' && permissions.includes('workshop-billing:read-sensitive');
}

/**
 * Explicit validation is offered only once work is under way (or done) to
 * someone who may validate. WAITING, ASSIGNED and CANCELLED never validate.
 */
export function canValidateBilling(
  status: WorkshopWorkOrderStatus,
  permissions: readonly string[],
): boolean {
  return (
    (status === 'IN_PROGRESS' || status === 'PAUSED' || status === 'DONE') &&
    permissions.includes('workshop-billing:validate') &&
    permissions.includes('workshop-billing:read-sensitive')
  );
}

/** "0.11" -> "11", "0.125" -> "12.5". Display only; string math avoids float noise. */
export function formatTaxRate(rate: string): string {
  const [whole = '0', fraction = ''] = rate.split('.');
  const padded = fraction.padEnd(2, '0');
  const integer = String(Number(`${whole}${padded.slice(0, 2)}`));
  const rest = padded.slice(2).replace(/0+$/, '');
  return rest ? `${integer}.${rest}` : integer;
}

export const BILLING_STATE_LABEL: Record<WorkshopBillingValidationState, string> = {
  DRAFT: 'Not validated',
  VALIDATED: 'Validated',
  REVALIDATION_REQUIRED: 'Needs revalidation',
};

export const BILLING_STATE_BADGE: Record<
  WorkshopBillingValidationState,
  'outline' | 'success' | 'warning'
> = {
  DRAFT: 'outline',
  VALIDATED: 'success',
  REVALIDATION_REQUIRED: 'warning',
};

/** Runtime error codes billing can present. Keys are Runtime's exact codes. */
export const WORKSHOP_BILLING_ERROR_COPY: Record<string, string> = {
  WORKSHOP_BILLING_STATE_INVALID:
    'Billing cannot be validated while the Work Order is in this status.',
  WORKSHOP_BILLING_ALREADY_VALIDATED: 'This billing is already validated.',
  WORKSHOP_BILLING_CURRENCY_MISMATCH:
    'The items use different currencies, so billing cannot be calculated.',
  WORKSHOP_BILLING_NOT_FOUND: 'Billing is not available yet. Reload the Work Order.',
  FORBIDDEN: 'You do not have permission to validate this billing.',
};

/** Conflicts whose cause is a changed billing: the reviewed numbers are out of date. */
export const WORKSHOP_BILLING_STALE_CODES: readonly string[] = [
  'VERSION_CONFLICT',
  'WORKSHOP_BILLING_ALREADY_VALIDATED',
  'WORKSHOP_BILLING_NOT_FOUND',
];
