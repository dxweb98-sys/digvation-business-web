import { describe, expect, it } from 'vitest';

import {
  canQuickEnrollMember,
  memberSaleSelection,
  type MemberLookupResult,
} from './customer-member-api';

describe('Operational customer/member selection', () => {
  it('shows contextual enrollment only to the membership enrollment permission', () => {
    expect(canQuickEnrollMember(['membership:read', 'membership:enroll'])).toBe(true);
    expect(canQuickEnrollMember(['membership:read'])).toBe(false);
  });

  it('uses the canonical customer reference when selecting an active member for a sale', () => {
    const member: MemberLookupResult = {
      id: 'membership-1',
      customerId: 'customer-1',
      memberNumber: 'MEMBER-001',
      status: 'ACTIVE',
      customer: { id: 'customer-1', name: 'Rina', phoneE164: '+628123456789', status: 'ACTIVE' },
    };

    expect(memberSaleSelection(member)).toEqual({ type: 'MEMBER', referenceId: 'customer-1' });
  });
});
