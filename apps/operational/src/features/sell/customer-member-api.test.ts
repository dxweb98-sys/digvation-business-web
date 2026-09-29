import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@digvation/business-api';

import {
  canQuickEnrollMember,
  CustomerMemberApi,
  memberSaleSelection,
  sanitizeNikInput,
  sanitizePhoneInput,
  toIndonesianE164,
  type MemberLookupResult,
} from './customer-member-api';

describe('Operational member input boundary', () => {
  it('converts Indonesian local numbers to E.164 without double conversion', () => {
    expect(toIndonesianE164('081234567890')).toBe('+6281234567890');
    expect(toIndonesianE164('+6281234567890')).toBe('+6281234567890');
    expect(toIndonesianE164('6281234567890')).toBe('+6281234567890');
    expect(toIndonesianE164('0812 3456-7890')).toBe('+6281234567890');
  });

  it('rejects values that cannot be a canonical phone number', () => {
    expect(toIndonesianE164('')).toBeNull();
    expect(toIndonesianE164('0812abc')).toBeNull();
    expect(toIndonesianE164('812345678')).toBeNull();
    expect(toIndonesianE164('0812')).toBeNull();
  });

  it('sanitizes phone and NIK input', () => {
    expect(sanitizePhoneInput('08a1-2 3')).toBe('08123');
    expect(sanitizePhoneInput('+62 812')).toBe('+62812');
    expect(sanitizeNikInput('3174abcd123456789999')).toBe('3174123456789999');
  });

  it('posts enrollment with an E.164 phone and refuses an invalid one', async () => {
    const post = vi.fn().mockResolvedValue({});
    const api = new CustomerMemberApi({ post } as unknown as ApiClient);

    await api.enrollNew({ name: 'Budi', phone: '081234567890', nik: '3174123456789999' });
    expect(post).toHaveBeenCalledWith('/api/v1/memberships', {
      name: 'Budi',
      phone: '+6281234567890',
      nik: '3174123456789999',
    });

    await expect(api.enrollNew({ name: 'Budi', phone: '12ab', nik: '1' })).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });
});

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
