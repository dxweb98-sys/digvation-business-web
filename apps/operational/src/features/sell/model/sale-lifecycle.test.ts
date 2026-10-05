import { describe, expect, it, vi } from 'vitest';

import type { Sale } from './cashier-transaction.types';
import { hasStartableQueuedWork } from './queued-sale-work';
import {
  blocksNewTransaction,
  checkoutCompletionOf,
  completeSettledCheckout,
  hasTrackedWork,
  isFullySettled,
  isInstantOnly,
} from './sale-lifecycle';

type LineKind = 'PRODUCT' | 'SERVICE' | 'REMOVED_SERVICE';
type Payment = { status: 'SUCCEEDED' | 'PENDING' | 'FAILED'; applied: string };

function saleWith(
  kinds: LineKind[],
  payments: Payment[] = [],
  total = '200000.0000',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'sale-1',
    status: 'OPEN',
    operationalState: 'UNSUBMITTED',
    version: 3,
    totalAmount: total,
    lines: kinds.map((kind, index) => ({
      id: `line-${index}`,
      removedAt: kind === 'REMOVED_SERVICE' ? '2026-09-29T00:00:00.000Z' : null,
      itemTypeSnapshot: kind === 'PRODUCT' ? 'PRODUCT' : 'SERVICE',
      fulfillmentBehaviorSnapshot: kind === 'PRODUCT' ? 'INSTANT' : 'TRACKED',
      fulfillment: kind === 'PRODUCT' ? null : { status: 'WAITING' },
    })),
    payments: payments.map((payment, index) => ({
      id: `payment-${index}`,
      status: payment.status,
      appliedAmount: payment.applied,
    })),
    ...overrides,
  } as unknown as Sale;
}

const paid = (applied: string): Payment => ({ status: 'SUCCEEDED', applied });
const pending = (applied: string): Payment => ({ status: 'PENDING', applied });

function ports() {
  return {
    queue: vi.fn(async (sale: Sale) => ({ ...sale, operationalState: 'QUEUED' }) as Sale),
    finalizeInstant: vi.fn(async (sale: Sale) => ({ ...sale, status: 'FINALIZED' }) as Sale),
  };
}

describe('lifecycle classification', () => {
  it('classifies by fulfillment behavior of ACTIVE lines, not by item type', () => {
    expect(hasTrackedWork(saleWith(['PRODUCT']))).toBe(false);
    expect(isInstantOnly(saleWith(['PRODUCT', 'PRODUCT']))).toBe(true);
    expect(hasTrackedWork(saleWith(['SERVICE']))).toBe(true);
    expect(hasTrackedWork(saleWith(['PRODUCT', 'SERVICE']))).toBe(true);
    expect(isInstantOnly(saleWith(['PRODUCT', 'SERVICE']))).toBe(false);
  });

  it('ignores removed lines: a retired Service source does not force the tracked workflow', () => {
    expect(hasTrackedWork(saleWith(['PRODUCT', 'REMOVED_SERVICE']))).toBe(false);
    expect(isInstantOnly(saleWith(['PRODUCT', 'REMOVED_SERVICE']))).toBe(true);
  });

  it('a Product salesperson (DIG-240 attribution) never changes the lifecycle classification', () => {
    const attributed = saleWith(['PRODUCT'], [paid('200000.0000')]);
    (attributed.lines[0] as unknown as Record<string, unknown>).soldByEmployeeId = 'emp-andi';
    expect(hasTrackedWork(attributed)).toBe(false);
    expect(isInstantOnly(attributed)).toBe(true);
    expect(checkoutCompletionOf(attributed)).toBe('FINALIZE');
    const mixedAttributed = saleWith(['PRODUCT', 'SERVICE'], [paid('200000.0000')]);
    (mixedAttributed.lines[0] as unknown as Record<string, unknown>).soldByEmployeeId = 'emp-andi';
    expect(checkoutCompletionOf(mixedAttributed)).toBe('QUEUE');
  });

  it('an empty Sale is neither instant-only nor tracked', () => {
    expect(isInstantOnly(saleWith([]))).toBe(false);
    expect(hasTrackedWork(saleWith([]))).toBe(false);
  });
});

describe('full Product payment', () => {
  it('finalizes immediately, never queues, and never enters a work state', async () => {
    const sale = saleWith(['PRODUCT'], [paid('200000.0000')]);
    expect(isFullySettled(sale)).toBe(true);
    expect(checkoutCompletionOf(sale)).toBe('FINALIZE');

    const p = ports();
    const result = await completeSettledCheckout(sale, p);

    expect(result).toMatchObject({ kind: 'FINALIZED', sale: { status: 'FINALIZED' } });
    expect(p.finalizeInstant).toHaveBeenCalledTimes(1);
    expect(p.queue).not.toHaveBeenCalled();
    expect(hasStartableQueuedWork(sale)).toBe(false);
  });

  it('propagates a rejected finalize so the payment is kept and the operator can retry', async () => {
    const sale = saleWith(['PRODUCT'], [paid('200000.0000')]);
    const p = ports();
    p.finalizeInstant.mockRejectedValueOnce(new Error('offline'));
    await expect(completeSettledCheckout(sale, p)).rejects.toThrow('offline');
    expect(p.queue).not.toHaveBeenCalled();
    // The retry finalizes once it can.
    await expect(completeSettledCheckout(sale, p)).resolves.toMatchObject({ kind: 'FINALIZED' });
  });
});

describe('partial Product payment', () => {
  it('stays open: not queued, not finalized, and the remaining balance is what is left', async () => {
    const sale = saleWith(['PRODUCT'], [paid('100000.0000')]);
    expect(isFullySettled(sale)).toBe(false);
    expect(checkoutCompletionOf(sale)).toBe('AWAIT_PAYMENT');

    const p = ports();
    await expect(completeSettledCheckout(sale, p)).resolves.toEqual({ kind: 'AWAIT_PAYMENT' });
    expect(p.queue).not.toHaveBeenCalled();
    expect(p.finalizeInstant).not.toHaveBeenCalled();
  });

  it('collects across several payments and finalizes only when the last one settles it', async () => {
    const p = ports();
    const steps: Array<[Payment[], string]> = [
      [[paid('100000.0000')], 'AWAIT_PAYMENT'],
      [[paid('100000.0000'), pending('50000.0000')], 'AWAIT_PAYMENT'],
      [[paid('100000.0000'), paid('50000.0000')], 'AWAIT_PAYMENT'],
      [[paid('100000.0000'), paid('50000.0000'), paid('50000.0000')], 'FINALIZED'],
    ];
    for (const [payments, expected] of steps) {
      const result = await completeSettledCheckout(saleWith(['PRODUCT'], payments), p);
      expect(result.kind).toBe(expected);
    }
    expect(p.finalizeInstant).toHaveBeenCalledTimes(1);
    expect(p.queue).not.toHaveBeenCalled();
  });

  it('a failed or zero payment never counts toward settlement', () => {
    expect(
      checkoutCompletionOf(saleWith(['PRODUCT'], [{ status: 'FAILED', applied: '200000.0000' }])),
    ).toBe('AWAIT_PAYMENT');
    expect(checkoutCompletionOf(saleWith(['PRODUCT'], []))).toBe('AWAIT_PAYMENT');
  });
});

describe('pending provider payment', () => {
  it('does not finalize while pending, even if the amounts nominally cover the total', async () => {
    const sale = saleWith(['PRODUCT'], [paid('100000.0000'), pending('100000.0000')]);
    expect(isFullySettled(sale)).toBe(false);
    const p = ports();
    await expect(completeSettledCheckout(sale, p)).resolves.toEqual({ kind: 'AWAIT_PAYMENT' });
    expect(p.finalizeInstant).not.toHaveBeenCalled();
  });

  it('transition to SUCCEEDED with a balance left does not finalize', async () => {
    const afterTransition = saleWith(['PRODUCT'], [paid('100000.0000'), paid('50000.0000')]);
    const p = ports();
    await expect(completeSettledCheckout(afterTransition, p)).resolves.toEqual({
      kind: 'AWAIT_PAYMENT',
    });
    expect(p.finalizeInstant).not.toHaveBeenCalled();
  });

  it('transition to SUCCEEDED that exactly settles the Sale finalizes', async () => {
    const afterTransition = saleWith(['PRODUCT'], [paid('100000.0000'), paid('100000.0000')]);
    const p = ports();
    await expect(completeSettledCheckout(afterTransition, p)).resolves.toMatchObject({
      kind: 'FINALIZED',
    });
    expect(p.finalizeInstant).toHaveBeenCalledTimes(1);
  });
});

describe('a partly paid Product Sale cannot be silently abandoned', () => {
  it('blocks a new transaction after a successful partial payment', () => {
    expect(blocksNewTransaction(saleWith(['PRODUCT'], [paid('100000.0000')]))).toBe(true);
  });

  it('also blocks while a provider payment is pending', () => {
    expect(blocksNewTransaction(saleWith(['PRODUCT'], [pending('200000.0000')]))).toBe(true);
  });

  it('keeps the existing reset behavior for a Sale with no payment', () => {
    expect(blocksNewTransaction(saleWith(['PRODUCT'], []))).toBe(false);
    expect(blocksNewTransaction(null)).toBe(false);
    expect(blocksNewTransaction(undefined)).toBe(false);
  });

  it('permits a fresh transaction once the Sale is finalized', () => {
    const finalized = saleWith(['PRODUCT'], [paid('200000.0000')], '200000.0000', {
      status: 'FINALIZED',
    });
    expect(blocksNewTransaction(finalized)).toBe(false);
  });

  it('does not apply to a queue-tracked Sale, which lives in the queue', () => {
    expect(blocksNewTransaction(saleWith(['PRODUCT', 'SERVICE'], [paid('100000.0000')]))).toBe(
      false,
    );
  });
});

describe('mixed Product + tracked Service keeps the queue lifecycle', () => {
  const mixed = (payments: Payment[]) => saleWith(['PRODUCT', 'SERVICE'], payments, '300000.0000');

  it('queues once settled and never finalizes at checkout', async () => {
    const sale = mixed([paid('300000.0000')]);
    expect(checkoutCompletionOf(sale)).toBe('QUEUE');
    const p = ports();
    await expect(completeSettledCheckout(sale, p)).resolves.toMatchObject({ kind: 'QUEUED' });
    expect(p.queue).toHaveBeenCalledTimes(1);
    expect(p.finalizeInstant).not.toHaveBeenCalled();
  });

  it('exposes work only for the tracked Service; the Product has no work action', () => {
    const sale = mixed([paid('300000.0000')]);
    const active = sale.lines.filter((line) => line.removedAt === null);
    const trackedIds = active
      .filter((line) => line.fulfillmentBehaviorSnapshot === 'TRACKED')
      .map((line) => line.id);
    expect(trackedIds).toEqual(['line-1']);
    expect(active[0]!.fulfillment).toBeNull();
    const queued = (kinds: LineKind[]) =>
      saleWith(kinds, [paid('300000.0000')], '300000.0000', { operationalState: 'QUEUED' });
    expect(hasStartableQueuedWork(queued(['PRODUCT']))).toBe(false);
    expect(hasStartableQueuedWork(queued(['PRODUCT', 'SERVICE']))).toBe(true);
  });

  it('still waits for exact payment before queueing', async () => {
    const p = ports();
    await expect(completeSettledCheckout(mixed([paid('100000.0000')]), p)).resolves.toEqual({
      kind: 'AWAIT_PAYMENT',
    });
    expect(p.queue).not.toHaveBeenCalled();
  });

  it('a Service whose work is still incomplete is never finalized by the checkout path', async () => {
    const p = ports();
    await completeSettledCheckout(mixed([paid('300000.0000')]), p);
    expect(p.finalizeInstant).not.toHaveBeenCalled();
  });
});
