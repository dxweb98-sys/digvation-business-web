import type { SaleCustomer } from '../../transaction/model/cashier-transaction.types';
import { copyFor } from '../../transaction/model/sale-display';

/**
 * The Sale owns its customer identity, so presentation reads it straight from
 * the Sale. A Sale captured before the customer contract carries no identity:
 * it stays neutral and is never shown as a general or anonymous customer.
 */
export function customerDisplayName(
  customer: Pick<SaleCustomer, 'name'> | null,
  locale: string,
): string {
  return customer && customer.name.trim()
    ? customer.name
    : copyFor('Customer data is not available', locale);
}

export function customerDisplayDetail(customer: SaleCustomer | null): string | null {
  return customer && customer.phoneE164.trim() ? customer.phoneE164 : null;
}

export function customerInitials(customer: SaleCustomer | null): string {
  const name = customer?.name?.trim();
  if (!name) return '—';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function customerStatus(customer: SaleCustomer | null): {
  label: 'Member' | 'Non-member';
  variant: 'primary' | 'outline';
} | null {
  if (!customer) return null;
  return customer.type === 'MEMBER'
    ? { label: 'Member', variant: 'primary' }
    : { label: 'Non-member', variant: 'outline' };
}
