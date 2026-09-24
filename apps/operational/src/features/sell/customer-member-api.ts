import type { ApiClient } from '@digvation/business-api';

import type { ApiPage, SaleCustomerSelection } from './cashier-transaction.types';

const API_PREFIX = '/api/v1';
const LOOKUP_LIMIT = 20;

export interface CustomerLookupResult {
  id: string;
  name: string;
  phoneE164: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface MemberLookupResult {
  id: string;
  customerId: string;
  memberNumber: string;
  status: 'ACTIVE' | 'INACTIVE';
  customer: CustomerLookupResult;
}

export interface MemberPointBalance {
  membershipId: string;
  pointsBalance: string;
}

export interface EnrollNewMemberInput {
  name: string;
  phone: string;
  /** Input-only: callers must not persist or display this after submission. */
  nik: string;
}

export interface EnrollExistingCustomerInput {
  customerId: string;
  /** Input-only: callers must not persist or display this after submission. */
  nik: string;
}

export function canQuickEnrollMember(permissions: readonly string[]): boolean {
  return permissions.includes('membership:enroll');
}

export function memberSaleSelection(member: MemberLookupResult): SaleCustomerSelection {
  return { type: 'MEMBER', referenceId: member.customerId };
}

function lookupPath(path: string, query: string): string {
  const params = new URLSearchParams({
    limit: String(LOOKUP_LIMIT),
    offset: '0',
    q: query.trim(),
  });
  return `${API_PREFIX}${path}?${params.toString()}`;
}

/**
 * Thin Operational client over canonical Customer, Membership and Loyalty
 * authority. It deliberately owns no identity or enrollment state.
 */
export class CustomerMemberApi {
  public constructor(private readonly client: ApiClient) {}

  searchMembers(query: string, signal?: AbortSignal): Promise<ApiPage<MemberLookupResult>> {
    return this.client.get<ApiPage<MemberLookupResult>>(
      `${lookupPath('/memberships', query)}&status=ACTIVE`,
      { signal },
    );
  }

  searchCustomers(query: string, signal?: AbortSignal): Promise<ApiPage<CustomerLookupResult>> {
    return this.client.get<ApiPage<CustomerLookupResult>>(lookupPath('/customers', query), {
      signal,
    });
  }

  getPointBalance(membershipId: string, signal?: AbortSignal): Promise<MemberPointBalance> {
    return this.client.get<MemberPointBalance>(
      `${API_PREFIX}/loyalty/memberships/${membershipId}/balance`,
      { signal },
    );
  }

  enrollNew(input: EnrollNewMemberInput): Promise<MemberLookupResult> {
    return this.client.post<MemberLookupResult>(`${API_PREFIX}/memberships`, input);
  }

  enrollExisting(input: EnrollExistingCustomerInput): Promise<MemberLookupResult> {
    return this.client.post<MemberLookupResult>(
      `${API_PREFIX}/memberships/enroll-existing-customer`,
      input,
    );
  }
}
