import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { OperationalQueuePage } from '../../transaction/api/operational-projection-client';
import type { Sale } from '../../transaction/model/cashier-transaction.types';
import {
  AWAITING_SETTLEMENT_PAGE_SIZE,
  useAwaitingSettlementPages,
} from './use-awaiting-settlement-pages';

const awaiting = (id: string, sellingLocationId = 'loc-1') =>
  ({
    id,
    sellingLocationId,
    status: 'OPEN',
    operationalState: 'UNSUBMITTED',
    payments: [{ id: `p-${id}`, status: 'SUCCEEDED', appliedAmount: '1000.0000' }],
    lines: [],
  }) as unknown as Sale;

const queue = (items: Sale[], totals: Record<string, number>) =>
  ({
    items,
    receiptDeliveries: {},
    awaitingSettlementTotals: totals,
    limit: 100,
    offset: 0,
  }) as unknown as OperationalQueuePage;

describe('useAwaitingSettlementPages', () => {
  it('loads further bounded pages after the ones shown until every Sale is reachable', async () => {
    const shown = Array.from({ length: 100 }, (_, i) => awaiting(`s${i}`));
    const rest = Array.from({ length: 5 }, (_, i) => awaiting(`r${i}`));
    const listAwaitingSettlement = vi.fn(async () => ({
      items: rest,
      total: 105,
      limit: AWAITING_SETTLEMENT_PAGE_SIZE,
      offset: 100,
    }));
    const { result } = renderHook(() =>
      useAwaitingSettlementPages({
        adapter: { listAwaitingSettlement },
        queue: queue([...shown, awaiting('other', 'loc-2')], { 'loc-1': 105, 'loc-2': 1 }),
        locationId: 'loc-1',
      }),
    );
    expect(result.current.remaining).toBe(5);
    await act(async () => {
      await result.current.loadMore?.();
    });
    expect(listAwaitingSettlement).toHaveBeenCalledWith({
      sellingLocationId: 'loc-1',
      offset: 100,
      limit: AWAITING_SETTLEMENT_PAGE_SIZE,
    });
    expect(AWAITING_SETTLEMENT_PAGE_SIZE).toBeLessThanOrEqual(100);
    expect(result.current.items.map((s) => s.id)).toEqual(rest.map((s) => s.id));
    expect(result.current.remaining).toBe(0);
  });

  it('drops loaded pages once the location total changes, and offers nothing without the query', async () => {
    const rest = [awaiting('r0')];
    const adapter = {
      listAwaitingSettlement: vi.fn(async () => ({ items: rest, total: 2, limit: 50, offset: 1 })),
    };
    const { result, rerender } = renderHook(
      ({ total }) =>
        useAwaitingSettlementPages({
          adapter,
          queue: queue([awaiting('s0')], { 'loc-1': total }),
          locationId: 'loc-1',
        }),
      { initialProps: { total: 2 } },
    );
    await act(async () => {
      await result.current.loadMore?.();
    });
    expect(result.current.items).toHaveLength(1);
    rerender({ total: 1 });
    expect(result.current.items).toEqual([]);
    expect(result.current.remaining).toBe(0);

    const demo = renderHook(() =>
      useAwaitingSettlementPages({
        adapter: {},
        queue: queue([], { 'loc-1': 3 }),
        locationId: 'loc-1',
      }),
    );
    expect(demo.result.current.loadMore).toBeNull();
  });
});
