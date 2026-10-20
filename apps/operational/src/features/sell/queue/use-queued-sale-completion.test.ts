import { ApiError } from '@digvation/pos-api';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Sale } from '../transaction/model/cashier-transaction.types';
import { useQueuedSaleCompletion } from './use-queued-sale-completion';

/** A queued Sale whose stored payments match its stored total, so completion reaches Runtime. */
const settledSale = {
  id: 'sale-1',
  totalAmount: '249750.0000',
  payments: [{ status: 'SUCCEEDED', appliedAmount: '249750.0000' }],
  lines: [
    {
      id: 'line-1',
      removedAt: null,
      quantity: '1.0000',
      effectiveUnitPrice: '250000.0000',
      itemNameSnapshot: 'Layanan',
      itemTypeSnapshot: 'PRODUCT',
      fulfillmentBehaviorSnapshot: 'INSTANT',
    },
  ],
} as unknown as Sale;

function completion(failure: unknown) {
  const showToast = vi.fn();
  const hook = renderHook(() =>
    useQueuedSaleCompletion({
      workspace: { locale: 'id-ID', finalizeQueuedSale: vi.fn().mockRejectedValue(failure) },
      canReadCompleted: true,
      setQueueTab: vi.fn(),
      setQueueDetail: vi.fn(),
      setReceiptSaleId: vi.fn(),
      showToast,
      copy: (value) => value,
    }),
  );
  act(() => hook.result.current.completeQueuedTransaction(settledSale));
  return { hook, showToast };
}

describe('queued completion refusals', () => {
  it('leaves an unsettled refusal to the workspace notice and closes the confirmation', async () => {
    const { hook, showToast } = completion(new ApiError(409, 'SALE_NOT_SETTLED', 'raw'));
    await act(() => hook.result.current.confirmQueuedCompletion());
    expect(showToast).not.toHaveBeenCalled();
    expect(hook.result.current.completionConfirmationTarget).toBeNull();
  });

  it('keeps the generic failure message for any other refusal', async () => {
    const { hook, showToast } = completion(new ApiError(409, 'SALE_PAYMENT_PENDING', 'raw'));
    await act(() => hook.result.current.confirmQueuedCompletion());
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Could not complete transaction', variant: 'danger' }),
    );
    expect(hook.result.current.completionConfirmationTarget).not.toBeNull();
  });
});
