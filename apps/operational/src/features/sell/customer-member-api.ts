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

export const NIK_LENGTH = 16;

/** Keeps digits only, allowing a single leading "+" for numbers pasted in international form. */
export function sanitizePhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  return value.trimStart().startsWith('+') ? `+${digits}` : digits;
}

/** Input-only NIK: digits, never longer than the national identity number. */
export function sanitizeNikInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, NIK_LENGTH);
}

/**
 * Converts Indonesian cashier input (0812...) to the canonical E.164 value
 * (+62812...). Numbers already carrying the +62 / 62 country code are kept as-is
 * so they are never converted twice. Returns null when the value is not a
 * plausible E.164 number.
 */
export function toIndonesianE164(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, '');
  let e164: string;
  if (/^0[1-9]\d*$/.test(compact)) e164 = `+62${compact.slice(1)}`;
  else if (/^\+62[1-9]\d*$/.test(compact)) e164 = compact;
  else if (/^62[1-9]\d*$/.test(compact)) e164 = `+${compact}`;
  else return null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
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
    const phone = toIndonesianE164(input.phone);
    if (!phone) return Promise.reject(new Error('Invalid member phone number.'));
    return this.client.post<MemberLookupResult>(`${API_PREFIX}/memberships`, { ...input, phone });
  }

  enrollExisting(input: EnrollExistingCustomerInput): Promise<MemberLookupResult> {
    return this.client.post<MemberLookupResult>(
      `${API_PREFIX}/memberships/enroll-existing-customer`,
      input,
    );
  }
}
