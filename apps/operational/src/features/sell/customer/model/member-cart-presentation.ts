import type { MemberLookupResult } from '../api/customer-member-api';
import type { SaleCustomer } from '../../transaction/model/cashier-transaction.types';

/**
 * The Member the cashier already picked, when it is the Member of the transaction being served.
 * The picker's lookup result is the presentation authority for a local draft, so nothing has to be
 * searched again after choosing.
 */
export function activeMemberOf(
  customer: SaleCustomer | null,
  selectedMember: MemberLookupResult | null,
): MemberLookupResult | null {
  return customer?.type === 'MEMBER' && selectedMember?.customerId === customer.referenceId
    ? selectedMember
    : null;
}

/**
 * A local draft only knows which Member was chosen (the snapshot carries no name or phone). Fill
 * the identity from the already-selected Member lookup so the cart is complete before checkout.
 * Once a Sale exists its own customer snapshot is the authority and is returned untouched, so the
 * hand-over at commit time never changes what the cashier sees.
 */
export function presentedCustomer(
  customer: SaleCustomer | null,
  activeMember: MemberLookupResult | null,
  hasSale: boolean,
): SaleCustomer | null {
  if (hasSale || !customer || customer.type !== 'MEMBER' || !activeMember) return customer;
  return {
    ...customer,
    name: activeMember.customer.name,
    phoneE164: activeMember.customer.phoneE164,
  };
}

/**
 * The lookup by phone is only the fallback for a Member Sale opened without a local selection
 * (restored or reloaded). It needs a phone to search with and never runs once the Member is known.
 */
export function needsMemberIdentityLookup(input: {
  canReadMembers: boolean;
  customer: SaleCustomer | null;
  activeMember: MemberLookupResult | null;
}): boolean {
  const { canReadMembers, customer, activeMember } = input;
  return Boolean(
    canReadMembers &&
    customer?.type === 'MEMBER' &&
    customer.referenceId &&
    customer.phoneE164.trim() &&
    activeMember === null,
  );
}
