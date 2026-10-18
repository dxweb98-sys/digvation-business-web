import type { ApiClient } from '@digvation/business-api';
import { describe, expect, it, vi } from 'vitest';
import { CustomersApi, type Customer } from './customers-api';

describe('canonical Customer API boundary', () => {
  it('sends server pagination and search/status without fetching transaction history', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const api = new CustomersApi({ get } as unknown as ApiClient);
    await api.list({ q: 'Dicky +62812', status: 'ACTIVE', limit: 10, offset: 20 });
    const url = new URL(get.mock.calls[0]![0], 'https://runtime.test');
    expect(url.pathname).toBe('/api/v1/customers');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'Dicky +62812',
      status: 'ACTIVE',
      limit: '10',
      offset: '20',
    });
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('uses bounded Customer detail and versioned Customer profile update', async () => {
    const get = vi.fn().mockResolvedValue({});
    const patch = vi.fn().mockResolvedValue({});
    const api = new CustomersApi({ get, patch } as unknown as ApiClient);
    await api.detail('customer-a');
    await api.update({ id: 'customer-a', version: 4 } as Customer, {
      name: 'Dicky Darmawan',
      phone: '+628123456789',
    });
    expect(get).toHaveBeenCalledWith('/api/v1/customers/customer-a/detail');
    expect(patch).toHaveBeenCalledWith('/api/v1/customers/customer-a', {
      expectedVersion: 4,
      name: 'Dicky Darmawan',
      phone: '+628123456789',
    });
  });
});
