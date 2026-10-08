import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type {
  SalePricingPreview,
  SalePricingPreviewInput,
} from '../transaction/api/cashier-transaction.adapter';
import { useCartPricingPreview } from './use-cart-pricing-preview';

const copy = (value: string) => (value === 'Tax' ? 'Pajak' : value);

function cart(quantity: string, member?: string): SalePricingPreviewInput {
  return {
    sellingLocationId: 'location-1',
    currency: 'IDR',
    ...(member ? { customer: { type: 'MEMBER' as const, referenceId: member } } : {}),
    lines: [{ catalogItemId: 'item-1', quantity }],
  };
}

function priced(total: string, promotions: SalePricingPreview['promotions'] = []) {
  return {
    currency: 'IDR',
    grossAmount: '87000.0000',
    promotions,
    discountAmount: promotions.length ? '10000.0000' : '0.0000',
    netPreTaxAmount: '77000.0000',
    taxRate: '0.11',
    taxPriceTreatment: 'EXCLUDED',
    taxAmount: '8470.0000',
    totalAmount: total,
  } satisfies SalePricingPreview;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function setup(
  previewSalePricing: (
    input: SalePricingPreviewInput,
    signal?: AbortSignal,
  ) => Promise<SalePricingPreview>,
  initial: SalePricingPreviewInput | null,
) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ input }) => useCartPricingPreview({ adapter: { previewSalePricing }, input, copy }),
    { wrapper, initialProps: { input: initial } },
  );
}

describe('useCartPricingPreview', () => {
  it('shows Runtime subtotal, applicable Promotion rows, Tax and total', async () => {
    const preview = vi.fn(async () =>
      priced('85470.0000', [
        {
          promotionId: 'p-member',
          label: 'Promo Member',
          scope: 'TRANSACTION',
          amount: '10000.0000',
        },
      ]),
    );
    const { result } = setup(preview, cart('1', 'member-1'));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({
      grossAmount: '87000.0000',
      discountAmount: '10000.0000',
      discountRows: [{ key: 'p-member', label: 'Promo Member', amount: '10000.0000' }],
      taxAmount: '8470.0000',
      taxLabel: 'Pajak (11%)',
      totalAmount: '85470.0000',
    });
    expect(preview).toHaveBeenCalledWith(cart('1', 'member-1'), expect.any(AbortSignal));
  });

  it('shows no Promotion row when none applies', async () => {
    const { result } = setup(
      vi.fn(async () => priced('96570.0000')),
      cart('1'),
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.discountRows).toEqual([]);
  });

  it('never lets an older answer overwrite the current cart', async () => {
    const answers = new Map<string, ReturnType<typeof deferred<SalePricingPreview>>>();
    const preview = vi.fn((input: SalePricingPreviewInput) => {
      const answer = deferred<SalePricingPreview>();
      answers.set(input.lines[0]!.quantity, answer);
      return answer.promise;
    });
    const { result, rerender } = setup(preview, cart('1'));
    rerender({ input: cart('2') });

    // B (quantity 2) answers first, then the superseded A (quantity 1).
    await act(async () => answers.get('2')!.resolve(priced('193140.0000')));
    await waitFor(() => expect(result.current?.totalAmount).toBe('193140.0000'));
    await act(async () => answers.get('1')!.resolve(priced('96570.0000')));

    expect(result.current?.totalAmount).toBe('193140.0000');
  });

  it('keeps the last answer on screen while the next one loads, never blanking', async () => {
    const next = deferred<SalePricingPreview>();
    const preview = vi
      .fn()
      .mockResolvedValueOnce(priced('96570.0000'))
      .mockReturnValueOnce(next.promise);
    const { result, rerender } = setup(preview, cart('1'));
    await waitFor(() => expect(result.current?.totalAmount).toBe('96570.0000'));

    rerender({ input: cart('2') });
    expect(result.current?.totalAmount).toBe('96570.0000');

    await act(async () => next.resolve(priced('193140.0000')));
    await waitFor(() => expect(result.current?.totalAmount).toBe('193140.0000'));
  });

  it('asks again when the member changes, and drops a Promotion that no longer applies', async () => {
    const preview = vi.fn(async (input: SalePricingPreviewInput) =>
      input.customer
        ? priced('85470.0000', [
            {
              promotionId: 'p-member',
              label: 'Promo Member',
              scope: 'TRANSACTION',
              amount: '10000.0000',
            },
          ])
        : priced('96570.0000'),
    );
    const { result, rerender } = setup(preview, cart('1', 'member-1'));
    await waitFor(() => expect(result.current?.discountRows).toHaveLength(1));

    rerender({ input: cart('1') });
    await waitFor(() => expect(result.current?.discountRows).toEqual([]));
    expect(result.current?.totalAmount).toBe('96570.0000');
    expect(preview).toHaveBeenCalledTimes(2);
  });

  it('shows nothing from a failed preview, so the cart keeps its own estimate', async () => {
    const preview = vi
      .fn()
      .mockResolvedValueOnce(priced('96570.0000'))
      .mockRejectedValueOnce(new Error('Runtime unavailable'));
    const { result, rerender } = setup(preview, cart('1'));
    await waitFor(() => expect(result.current).not.toBeNull());

    rerender({ input: cart('2') });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('asks nothing when there is no draft to price', () => {
    const preview = vi.fn();
    const { result } = setup(preview, null);
    expect(result.current).toBeNull();
    expect(preview).not.toHaveBeenCalled();
  });
});
