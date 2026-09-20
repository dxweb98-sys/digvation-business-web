import type { ApiClient } from '@digvation/business-api';
import { describe, expect, it, vi } from 'vitest';

import { DashboardApi } from './dashboard-api';

describe('DashboardApi daily summary', () => {
  it('loads the authoritative Runtime summary for the active location', async () => {
    const get = vi.fn().mockResolvedValue({
      date: '2026-09-20',
      currency: 'IDR',
      income: '100000.0000',
      expenses: '25000.0000',
      netRevenue: '75000.0000',
      totalTransactions: 4,
      financeAvailable: true,
      transactionCompletion: { total: 5, finalized: 4, voided: 1 },
    });
    const api = new DashboardApi({ get } as unknown as ApiClient);

    await api.dailySummary('00000000-0000-4000-8000-000000000010');

    expect(get).toHaveBeenCalledWith(
      '/api/v1/reports/dashboard-summary?sellingLocationId=00000000-0000-4000-8000-000000000010',
    );
  });
  it('requests only approved expenses for the Activity chart', async () => {
    const get = vi.fn().mockResolvedValue({});
    const api = new DashboardApi({ get } as unknown as ApiClient);

    await api.report('expenses', {
      from: '2026-09-01',
      to: '2026-09-20',
      locationId: '00000000-0000-4000-8000-000000000010',
      status: 'APPROVED',
    });

    expect(get).toHaveBeenCalledWith(
      '/api/v1/reports/expenses?dateFrom=2026-09-01&dateTo=2026-09-20&page=1&pageSize=100&sellingLocationId=00000000-0000-4000-8000-000000000010&status=APPROVED',
    );
  });
});
