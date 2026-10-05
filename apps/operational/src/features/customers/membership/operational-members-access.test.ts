import { describe, expect, it } from 'vitest';

import { membershipOperationalNavigation } from './membership-operational-navigation';
import {
  canEditOperationalMemberProfile,
  canReadOperationalMembers,
} from './operational-members-access';

describe('Operational Member access', () => {
  it('shows the Member surface only with the Membership capability and membership:read', () => {
    expect(canReadOperationalMembers(['membership:read'], ['MEMBERSHIP'])).toBe(true);
    expect(canReadOperationalMembers([], ['MEMBERSHIP'])).toBe(false);
    expect(canReadOperationalMembers(['membership:read'], [])).toBe(false);
    expect(canReadOperationalMembers(['membership:read'], ['LOYALTY_POINTS'])).toBe(false);
  });

  it('does not derive access from a role name or from unrelated permissions', () => {
    expect(
      canReadOperationalMembers(
        ['sales:create', 'customers:manage', 'loyalty:read'],
        ['MEMBERSHIP'],
      ),
    ).toBe(false);
  });

  it('allows profile editing through canonical Customer management, on top of reading', () => {
    expect(
      canEditOperationalMemberProfile(['membership:read', 'customers:manage'], ['MEMBERSHIP']),
    ).toBe(true);
    expect(canEditOperationalMemberProfile(['membership:read'], ['MEMBERSHIP'])).toBe(false);
    expect(canEditOperationalMemberProfile(['customers:manage'], ['MEMBERSHIP'])).toBe(false);
  });

  it('does not treat Membership lifecycle authority as profile editing', () => {
    expect(
      canEditOperationalMemberProfile(['membership:read', 'membership:update'], ['MEMBERSHIP']),
    ).toBe(false);
  });

  it('points the navigation entry at the gated /members route', () => {
    expect(membershipOperationalNavigation.items.map((item) => item.to)).toEqual(['/members']);
  });
});
