import { describe, expect, it, vi } from 'vitest';

import { HttpCashierTransactionAdapter } from './cashier-transaction.adapter';
import { attachOperationalProjection } from './operational-projection-client';

const refundDisbursement = { method: 'CASH' as const, paymentRouteId: 'route-cash' };

describe('refund-and-void transport', () => {
  it('sends the money-returned confirmation through the Operational entry point', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'sale-1' });
    const client = { post, get: vi.fn() } as never;
    const port = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));
    await port.voidSale('sale-1', 7, 'key-1', refundDisbursement, true);
    expect(post).toHaveBeenCalledWith(
      '/api/v1/operational/transactions/sale-1/void',
      { expectedVersion: 7, refundDisbursement, moneyReturned: true },
      { headers: { 'Idempotency-Key': 'key-1' } },
    );
  });

  it('sends it through the canonical Sales entry point too, and never by default', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'sale-1' });
    const adapter = new HttpCashierTransactionAdapter({ post } as never);
    await adapter.voidSale('sale-1', 7, 'key-2', refundDisbursement, true);
    await adapter.voidSale('sale-1', 7, 'key-3', refundDisbursement);
    expect(post.mock.calls[0]![1]).toEqual({
      expectedVersion: 7,
      refundDisbursement,
      moneyReturned: true,
    });
    expect(post.mock.calls[1]![1]).toEqual({ expectedVersion: 7, refundDisbursement });
  });

  it('pages awaiting settlement with bounded queries', async () => {
    const get = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 100 });
    const client = { post: vi.fn(), get } as never;
    const port = attachOperationalProjection(client, new HttpCashierTransactionAdapter(client));
    await port.listAwaitingSettlement!({ sellingLocationId: 'loc-1', offset: 100, limit: 50 });
    expect(get.mock.calls[0]![0]).toBe(
      '/api/v1/operational/queue/awaiting-settlement?sellingLocationId=loc-1&offset=100&limit=50',
    );
  });
});
