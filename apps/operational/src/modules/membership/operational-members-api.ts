import type { ApiClient } from '@digvation/business-api';

export type MemberStatus = 'ACTIVE' | 'INACTIVE';
export type PointLedgerType = 'EARN' | 'REDEEM' | 'EARN_REVERSAL' | 'REDEEM_REVERSAL';

export interface MemberCustomer {
  id: string;
  name: string;
  phoneE164: string;
  status: MemberStatus;
  version: number;
}

/** Canonical Membership as Runtime returns it; the NIK never appears. */
export interface Member {
  id: string;
  customerId: string;
  customer: MemberCustomer;
  memberNumber: string;
  status: MemberStatus;
  joinedAt: string;
}

export interface MemberPage {
  items: Member[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface PointLedgerEntry {
  id: string;
  type: PointLedgerType;
  /** Signed: reversals are compensating entries, never edits of the original. */
  pointsDelta: string;
  balanceAfter: string;
  sourceSaleId: string;
  reversesLedgerEntryId: string | null;
  createdAt: string;
}

export interface MemberTransaction {
  saleId: string;
  saleNumber: string;
  currency: string;
  totalAmount: string;
  finalizedAt: string | null;
  pointsEarned: string | null;
  pointsRedeemed: string | null;
}

export interface MemberDetail {
  membership: Member;
  /** Null when Loyalty Points is not part of the business's entitlements. */
  loyalty: { pointsBalance: string; recentActivity: PointLedgerEntry[] } | null;
  /** Most recent finalized Sales of this Member, newest first. Bounded by Runtime (10). */
  recentTransactions: MemberTransaction[];
  /** All finalized Sales of this Member, to disclose when only the most recent are shown. */
  transactionTotal: number;
}

export const MEMBER_PAGE_SIZE = 20;

/**
 * Thin Operational client over the canonical Membership list, the constrained Operational
 * Member detail projection and the canonical Customer update. It owns no Member state.
 */
export class OperationalMembersApi {
  public constructor(private readonly client: ApiClient) {}

  list(input: { q?: string; offset: number }, signal?: AbortSignal): Promise<MemberPage> {
    const params = new URLSearchParams({
      limit: String(MEMBER_PAGE_SIZE),
      offset: String(input.offset),
    });
    if (input.q) params.set('q', input.q);
    return this.client.get<MemberPage>(`/api/v1/memberships?${params.toString()}`, { signal });
  }

  detail(membershipId: string, signal?: AbortSignal): Promise<MemberDetail> {
    return this.client.get<MemberDetail>(`/api/v1/operational/members/${membershipId}`, {
      signal,
    });
  }

  /** Canonical Customer profile update; Runtime owns name/phone validation and normalization. */
  updateProfile(
    member: Pick<Member, 'customerId'> & { customer: Pick<MemberCustomer, 'version'> },
    input: { name: string; phone: string },
  ): Promise<MemberCustomer> {
    return this.client.patch<MemberCustomer>(`/api/v1/customers/${member.customerId}`, {
      expectedVersion: member.customer.version,
      name: input.name.trim(),
      phone: input.phone.trim(),
    });
  }
}
