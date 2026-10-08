import { describe, expect, it, vi } from 'vitest';

import type { CustomerLookupResult } from '../api/customer-member-api';
import { findExistingCustomerCandidates } from './existing-customer-candidates';

const PHONE = '+628192381923';
const customer = (
  id: string,
  overrides: Partial<CustomerLookupResult> = {},
): CustomerLookupResult => ({
  id,
  name: `Pelanggan ${id}`,
  phoneE164: PHONE,
  status: 'ACTIVE',
  ...overrides,
});

describe('findExistingCustomerCandidates', () => {
  it('searches by the canonical phone and keeps only exact ACTIVE matches', async () => {
    const searchCustomers = vi.fn().mockResolvedValue({
      items: [
        customer('a'),
        customer('longer', { phoneE164: `${PHONE}0` }),
        customer('other', { phoneE164: '+628111111111' }),
        customer('inactive', { status: 'INACTIVE' }),
        customer('b'),
      ],
    });
    const result = await findExistingCustomerCandidates({ searchCustomers }, PHONE);
    expect(searchCustomers).toHaveBeenCalledWith(PHONE);
    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('returns nothing when no Customer matches exactly', async () => {
    const searchCustomers = vi.fn().mockResolvedValue({
      items: [customer('longer', { phoneE164: `${PHONE}0` })],
    });
    await expect(findExistingCustomerCandidates({ searchCustomers }, PHONE)).resolves.toEqual([]);
  });
});
