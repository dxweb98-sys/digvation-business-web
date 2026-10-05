import type { ApiClient } from '@digvation/pos-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HttpCashierTransactionAdapter, type EmployeeQuery } from './cashier-transaction.adapter';
import type { Employee } from '../model/cashier-transaction.types';
import { attachOperationalProjection } from './operational-projection-client';
import { useEmployeeOptions } from './use-employee-options';

const employee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  code: id.toUpperCase(),
  displayName: id,
  status: 'ACTIVE',
  canPerformServices: true,
  version: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});
const page = (items: Employee[]) => ({ items, total: items.length, limit: 100, offset: 0 });

function fakeClient() {
  const get = vi.fn<(path: string) => Promise<ReturnType<typeof page>>>(async () => page([]));
  return { get, client: { get } as unknown as ApiClient };
}

describe('Service performer query contract', () => {
  it('reads effective performers from the Operational performer endpoint', async () => {
    const { get, client } = fakeClient();
    const port = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));

    await port.listServicePerformers();
    await port.listProductSalespeople();

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/operational/employees',
      '/api/v1/operational/product-salespeople',
    ]);
  });

  it('asks the Employee API for canPerformServices, separately from Product salespeople', async () => {
    const { get, client } = fakeClient();
    const adapter = new HttpCashierTransactionAdapter(client);

    await adapter.listServicePerformers();
    await adapter.listProductSalespeople();

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/employees?limit=100&offset=0&canPerformServices=true',
      '/api/v1/employees?limit=100&offset=0&canSellProducts=true',
    ]);
  });
});

describe('useEmployeeOptions', () => {
  function setup(listServicePerformers: EmployeeQuery['listServicePerformers']) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const query: EmployeeQuery = {
      listServicePerformers,
      listProductSalespeople: vi.fn(async () => page([])),
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return renderHook(() => useEmployeeOptions(query, true), { wrapper });
  }

  it('shows exactly the performers Runtime returns, without re-deriving eligibility', async () => {
    // Runtime vouched for this employee even though no Position details are attached here.
    const listed = employee('dita', { position: null });
    const { result } = setup(vi.fn(async () => page([listed])));

    await waitFor(() => expect(result.current.employees).toEqual([listed]));
  });

  it('re-reads Runtime on refresh so Backoffice changes show without waiting', async () => {
    const listServicePerformers = vi
      .fn()
      .mockResolvedValueOnce(page([employee('andini'), employee('rindu')]))
      // Backoffice made Sari eligible and opted Rindu out in the meantime.
      .mockResolvedValueOnce(page([employee('andini'), employee('sari')]));
    const { result } = setup(listServicePerformers);
    await waitFor(() => expect(result.current.employees).toHaveLength(2));

    act(() => result.current.refresh());

    await waitFor(() =>
      expect(result.current.employees.map((entry) => entry.id)).toEqual(['andini', 'sari']),
    );
    expect(listServicePerformers).toHaveBeenCalledTimes(2);
  });
});
