import { describe, expect, it } from 'vitest';

import type { SaleCustomer } from './cashier-transaction.types';
import type { MemberLookupResult } from '../api/customer-member-api';
import {
  activeMemberOf,
  needsMemberIdentityLookup,
  presentedCustomer,
} from './member-cart-presentation';

const member: MemberLookupResult = {
  id: 'membership-4',
  customerId: 'customer-4',
  memberNumber: 'MBR-000004',
  status: 'ACTIVE',
  customer: { id: 'customer-4', name: 'Alex', phoneE164: '+6285966356803', status: 'ACTIVE' },
};

// What a local draft knows about a chosen Member: only which one, no name or phone.
const draftMember: SaleCustomer = {
  type: 'MEMBER',
  referenceId: 'customer-4',
  name: '',
  phoneE164: '',
};

const saleMember: SaleCustomer = {
  type: 'MEMBER',
  referenceId: 'customer-4',
  name: 'Alex',
  phoneE164: '+6285966356803',
};

describe('Member presentation for a local draft (no Sale yet)', () => {
  it('reuses the picked Member as the active Member, without any search', () => {
    expect(activeMemberOf(draftMember, member)).toBe(member);
  });

  it('completes the draft identity from the picked Member: name and phone appear before Payment', () => {
    const shown = presentedCustomer(draftMember, activeMemberOf(draftMember, member), false);

    expect(shown).toMatchObject({
      type: 'MEMBER',
      referenceId: 'customer-4',
      name: 'Alex',
      phoneE164: '+6285966356803',
    });
  });

  it('never runs the phone lookup when the Member is already known', () => {
    expect(
      needsMemberIdentityLookup({
        canReadMembers: true,
        customer: draftMember,
        activeMember: activeMemberOf(draftMember, member),
      }),
    ).toBe(false);
  });

  it('does not pretend a different picked Member belongs to this transaction', () => {
    expect(activeMemberOf(draftMember, { ...member, customerId: 'customer-9' })).toBeNull();
    expect(activeMemberOf(null, member)).toBeNull();
    expect(
      activeMemberOf(
        { type: 'NON_MEMBER', referenceId: null, name: 'Walk', phoneE164: '+62' },
        member,
      ),
    ).toBeNull();
  });

  it('leaves a non-member draft customer untouched', () => {
    const walkIn: SaleCustomer = {
      type: 'NON_MEMBER',
      referenceId: null,
      name: 'Walk',
      phoneE164: '+62811',
    };

    expect(presentedCustomer(walkIn, member, false)).toBe(walkIn);
    expect(presentedCustomer(null, member, false)).toBeNull();
  });
});

describe('hand-over from the draft to the persisted Sale', () => {
  it('shows the same identity before and after commit, so nothing flickers', () => {
    const before = presentedCustomer(draftMember, activeMemberOf(draftMember, member), false);
    const after = presentedCustomer(saleMember, activeMemberOf(saleMember, member), true);

    expect(after).toEqual(before);
  });

  it('gives the Sale customer authority once a Sale exists', () => {
    const renamed = { ...saleMember, name: 'Alex (Runtime)' };

    expect(presentedCustomer(renamed, member, true)).toBe(renamed);
  });
});

describe('fallback for a persisted Member Sale without a local selection', () => {
  it('looks the Member up by the Sale customer phone', () => {
    expect(
      needsMemberIdentityLookup({ canReadMembers: true, customer: saleMember, activeMember: null }),
    ).toBe(true);
  });

  it('shows the Sale identity as-is while the lookup is pending', () => {
    expect(presentedCustomer(saleMember, null, true)).toBe(saleMember);
  });

  it('does not search without the read permission, a reference, or a phone to search with', () => {
    const base = { canReadMembers: true, customer: saleMember, activeMember: null };

    expect(needsMemberIdentityLookup({ ...base, canReadMembers: false })).toBe(false);
    expect(needsMemberIdentityLookup({ ...base, customer: draftMember })).toBe(false);
    expect(
      needsMemberIdentityLookup({ ...base, customer: { ...saleMember, referenceId: null } }),
    ).toBe(false);
    expect(needsMemberIdentityLookup({ ...base, customer: null })).toBe(false);
  });
});
