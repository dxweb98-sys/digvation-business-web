import type { ApiClient } from '@digvation/business-api';
import { describe, expect, it, vi } from 'vitest';

import { LoyaltyApi } from './loyalty-api';

describe('LoyaltyApi', () => {
  it('loads Runtime-owned loyalty configuration and earning rules', async () => {
    const get = vi.fn().mockResolvedValue({});
    const api = new LoyaltyApi({ get } as unknown as ApiClient);

    await api.getConfiguration();
    await api.listEarningRules();

    expect(get).toHaveBeenNthCalledWith(1, '/api/v1/loyalty/configuration');
    expect(get).toHaveBeenNthCalledWith(2, '/api/v1/loyalty/earning-rules');
  });

  it('sends the complete configuration resource with Runtime expectedVersion', async () => {
    const put = vi.fn().mockResolvedValue({});
    const api = new LoyaltyApi({ put } as unknown as ApiClient);
    const input = {
      expectedVersion: 4,
      defaultEarningBehavior: 'FIXED' as const,
      defaultFixedPointsPerUnit: 2,
      pointValue: '1000',
    };

    await api.updateConfiguration(input);

    expect(put).toHaveBeenCalledWith('/api/v1/loyalty/configuration', input);
  });

  it('uses version zero and zero fixed points when creating an excluded override', async () => {
    const put = vi.fn().mockResolvedValue({});
    const api = new LoyaltyApi({ put } as unknown as ApiClient);
    const input = {
      expectedVersion: 0,
      behavior: 'EXCLUDED' as const,
      fixedPointsPerUnit: 0,
    };

    await api.updateEarningRule('catalog-item-1', input);

    expect(put).toHaveBeenCalledWith('/api/v1/loyalty/earning-rules/catalog-item-1', input);
  });
});
