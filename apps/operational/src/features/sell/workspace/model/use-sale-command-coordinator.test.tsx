import { ApiError } from '@digvation/pos-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { SaleTransactionClient } from '../../transaction/api/cashier-transaction.adapter';
import type { Sale } from '../../transaction/model/cashier-transaction.types';
import { useSaleCommandCoordinator } from './use-sale-command-coordinator';

vi.mock('@digvation/pos-runtime', () => ({ useRuntime: () => ({ locale: 'id-ID' }) }));

const unsettled = new ApiError(409, 'SALE_NOT_SETTLED', 'raw');

/** An OPEN Sale stored fully paid at the previous total, with an item discount on an addition line. */
const legacySale = (overrides: Partial<Sale> = {}) =>
  ({
    id: 'sale-1',
    status: 'OPEN',
    operationalState: 'UNSUBMITTED',
    totalAmount: '249750.0000',
    payments: [{ status: 'SUCCEEDED', appliedAmount: '249750.0000' }],
    lines: [
      {
        removedAt: null,
        discountType: 'PERCENTAGE',
        compositionComponents: [{ componentSource: 'SALE_SELECTED' }],
      },
    ],
    ...overrides,
  }) as unknown as Sale;

function coordinator(latest: Sale, permissions: string[], capabilities: string[] = []) {
  const getSale = vi.fn().mockResolvedValue(latest);
  const client = { getSale } as unknown as SaleTransactionClient;
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useSaleCommandCoordinator({
        client,
        rememberSale: () => undefined,
        permissions,
        capabilities,
      }),
    { wrapper },
  );
  return { hook, getSale };
}

describe('unsettled finalization recovery', () => {
  it('re-reads the transaction and guides a discount re-application', async () => {
    const { hook, getSale } = coordinator(legacySale(), ['sales:discount']);
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(getSale).toHaveBeenCalledWith('sale-1');
    expect(hook.result.current.notice).toBe(
      'Total transaksi perlu diperbarui karena aturan diskon item berubah. Buka diskon item, hapus lalu terapkan kembali diskon yang sesuai. Periksa total terbaru sebelum menyelesaikan pembayaran.',
    );
  });

  it('sends a cashier without the discount permission to a Manager or Owner', async () => {
    const { hook } = coordinator(legacySale(), ['sales:read', 'sales:create']);
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(hook.result.current.notice).toMatch(
      /^Total transaksi perlu diperbarui.*Minta Manajer atau Pemilik/,
    );
  });

  it('keeps ordinary payment guidance when an amount is still open', async () => {
    const { hook } = coordinator(
      legacySale({
        payments: [{ status: 'SUCCEEDED', appliedAmount: '100000.0000' }],
      } as Partial<Sale>),
      ['sales:discount'],
    );
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(hook.result.current.notice).not.toMatch(/diskon item/);
  });

  it('gives an unrelated settlement refusal no discount guidance', async () => {
    const { hook } = coordinator(
      legacySale({
        lines: [{ removedAt: null, discountType: null, compositionComponents: [] }],
      } as unknown as Partial<Sale>),
      ['sales:discount'],
    );
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(hook.result.current.notice).not.toMatch(/diskon item/);
  });

  it('exposes the Promotion refresh recovery only while its notice is shown', async () => {
    const promoted = legacySale({
      lines: [
        {
          id: 'line-1',
          removedAt: null,
          discountType: null,
          compositionComponents: [{ componentSource: 'SALE_SELECTED' }],
        },
      ],
      adjustments: [{ source: 'PROMOTION', saleLineId: 'line-1' }],
    } as unknown as Partial<Sale>);
    const { hook } = coordinator(promoted, ['sales:update'], ['PROMOTIONS']);
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(hook.result.current.notice).toBe(
      'Total transaksi perlu diperbarui karena aturan promo item berubah. Pilih Perbarui total, lalu periksa total terbaru sebelum menyelesaikan pembayaran.',
    );
    expect(hook.result.current.settlementRecovery).toMatchObject({
      saleId: 'sale-1',
      refusal: 'PROMOTION_REPRICE',
    });
    act(() => hook.result.current.clearNotice());
    expect(hook.result.current.settlementRecovery).toBeNull();
  });

  it('never exposes the Promotion refresh where Promotions are disabled', async () => {
    const promoted = legacySale({
      lines: [
        {
          id: 'line-1',
          removedAt: null,
          discountType: null,
          compositionComponents: [{ componentSource: 'SALE_SELECTED' }],
        },
      ],
      adjustments: [{ source: 'PROMOTION', saleLineId: 'line-1' }],
    } as unknown as Partial<Sale>);
    const { hook } = coordinator(promoted, ['sales:update', 'sales:discount'], []);
    await act(() => hook.result.current.recoverFailure(unsettled, 'sale-1'));
    expect(hook.result.current.settlementRecovery?.refusal).toBe('UNSETTLED');
    expect(hook.result.current.notice).toBe(
      'Selesaikan sisa pembayaran sebelum menyelesaikan transaksi ini.',
    );
  });
});
