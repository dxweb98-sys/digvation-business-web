import { describe, expect, it, vi } from 'vitest';

import { findExistingCustomerCandidates } from './existing-customer-candidates';
import type { Customer } from './members-api';

const PHONE = '+628192381923';
const customer = (id: string, overrides: Partial<Customer> = {}): Customer => ({
  id,
  name: `Pelanggan ${id}`,
  phoneE164: PHONE,
  version: 1,
  status: 'ACTIVE',
  ...overrides,
});

describe('findExistingCustomerCandidates', () => {
  it('searches by the canonical phone and keeps only exact ACTIVE matches', async () => {
    const searchCustomers = vi.fn().mockResolvedValue({
      items: [
        customer('a'),
        customer('longer', { phoneE164: `${PHONE}0` }),
        customer('inactive', { status: 'INACTIVE' }),
        customer('b'),
      ],
      total: 4,
    });
    const result = await findExistingCustomerCandidates({ searchCustomers }, PHONE);
    expect(searchCustomers).toHaveBeenCalledWith(PHONE);
    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
