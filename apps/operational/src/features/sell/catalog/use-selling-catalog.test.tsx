import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { CatalogItem } from '../transaction/model/cashier-transaction.types';
import { useSellingCatalog } from './use-selling-catalog';

const base = {
  categoryId: null,
  description: null,
  lifecycle: 'ACTIVE',
  fulfillmentBehavior: 'INSTANT',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  serviceDefinition: null,
} as const;

const variant = (name: string, code: string, status: 'ACTIVE' | 'INACTIVE') =>
  ({ id: code, name, code, status }) as never;

const items: CatalogItem[] = [
  {
    ...base,
    id: 'paint',
    code: 'CAT-001',
    name: 'Cat Dulux',
    type: 'PRODUCT',
    variants: [
      variant('Merah', 'CAT-001-RED', 'ACTIVE'),
      variant('Merah Marun', 'CAT-001-MRN', 'ACTIVE'),
      variant('Hijau', 'CAT-001-GRN', 'INACTIVE'),
    ],
  },
  { ...base, id: 'cut', code: 'SVC-1', name: 'Potong Rambut', type: 'SERVICE' },
];

function setup() {
  const getOperationalCatalog = vi.fn().mockResolvedValue({ categories: [], items });
  const listCatalogVariants = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useSellingCatalog({
        query: { getOperationalCatalog, listCatalogVariants } as never,
        locale: 'id-ID',
        sellingLocationId: 'location-1',
        currency: 'IDR',
      }),
    { wrapper },
  );
  return { hook, getOperationalCatalog, listCatalogVariants };
}

describe('useSellingCatalog search', () => {
  it('finds the parent item by active variant, once, without any variant request', async () => {
    const { hook, getOperationalCatalog, listCatalogVariants } = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.setItemType('ALL'));

    act(() => hook.result.current.setSearch('merah'));
    expect(hook.result.current.items.map((item) => item.id)).toEqual(['paint']);

    act(() => hook.result.current.setSearch('cat-001-red'));
    expect(hook.result.current.items.map((item) => item.id)).toEqual(['paint']);

    act(() => hook.result.current.setSearch('hijau'));
    expect(hook.result.current.items).toEqual([]);

    expect(getOperationalCatalog).toHaveBeenCalledTimes(1);
    expect(listCatalogVariants).not.toHaveBeenCalled();
  });

  it('still applies the item type filter and the empty search', async () => {
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

    act(() => hook.result.current.setItemType('SERVICE'));
    act(() => hook.result.current.setSearch('merah'));
    expect(hook.result.current.items).toEqual([]);

    act(() => hook.result.current.setSearch(''));
    expect(hook.result.current.items.map((item) => item.id)).toEqual(['cut']);

    act(() => hook.result.current.setItemType('ALL'));
    expect(hook.result.current.items.map((item) => item.id)).toEqual(['paint', 'cut']);
  });
});

describe('useSellingCatalog page filter vs. every active item', () => {
  const withComponentOnly: CatalogItem[] = [
    ...items,
    {
      ...base,
      id: 'resin',
      code: 'CMP-1',
      name: 'Resin',
      type: 'PRODUCT',
      productUsage: 'COMPONENT_ONLY',
    } as CatalogItem,
  ];
  function setupAll() {
    const getOperationalCatalog = vi
      .fn()
      .mockResolvedValue({ categories: [], items: withComponentOnly });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );
    const hook = renderHook(
      () =>
        useSellingCatalog({
          query: { getOperationalCatalog, listCatalogVariants: vi.fn() } as never,
          locale: 'id-ID',
          sellingLocationId: 'location-1',
          currency: 'IDR',
        }),
      { wrapper },
    );
    return { hook, getOperationalCatalog };
  }

  it.each([
    ['PRODUCT', ['paint'], ['paint', 'cut']],
    ['SERVICE', ['cut'], ['paint', 'cut']],
  ] as const)(
    'with the page on %s, activeItems still holds Products and Services from the one query',
    async (type, visible, active) => {
      const { hook, getOperationalCatalog } = setupAll();
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      act(() => hook.result.current.setItemType(type));
      expect(hook.result.current.items.map((item) => item.id)).toEqual(visible);
      expect(hook.result.current.activeItems.map((item) => item.id)).toEqual(active);
      expect(getOperationalCatalog).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the page search out of activeItems and never offers a COMPONENT_ONLY Product', async () => {
    const { hook } = setupAll();
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    act(() => hook.result.current.setSearch('potong'));
    expect(hook.result.current.activeItems.map((item) => item.id)).toEqual(['paint', 'cut']);
    expect(hook.result.current.findItem('paint')?.id).toBe('paint');
    expect(hook.result.current.findItem('resin')).toBeNull();
  });
});
