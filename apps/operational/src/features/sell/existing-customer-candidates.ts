import type { CustomerLookupResult, CustomerMemberApi } from './customer-member-api';

/**
 * Customers a phone conflict can be resolved to. Customer phone is not globally unique, so this
 * returns every ACTIVE Customer whose canonical phone is exactly the submitted one: a search hit
 * alone is never trusted, and nothing here picks a Customer on the operator's behalf.
 * Runtime has already established that none of them owns a Membership.
 */
export async function findExistingCustomerCandidates(
  api: Pick<CustomerMemberApi, 'searchCustomers'>,
  canonicalPhone: string,
): Promise<CustomerLookupResult[]> {
  const page = await api.searchCustomers(canonicalPhone);
  return page.items.filter(
    (customer) => customer.phoneE164 === canonicalPhone && customer.status === 'ACTIVE',
  );
}
