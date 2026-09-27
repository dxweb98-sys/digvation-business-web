import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReplaceLinePreview } from '../cashier-transaction.adapter';
import type { CatalogItem, Sale, SaleLine } from '../cashier-transaction.types';
import { ReferenceOrderAdjustmentDialog } from './replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '', deploymentProfile: 'DEDICATED', workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true }, branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' }, defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const items = [
  { id: 'source-item', code: 'SRC', name: 'Smoothing Curly', variantSelectionMode: 'NONE', variants: [] },
  { id: 'replacement-item', code: 'RPL', name: 'Hair Color', variantSelectionMode: 'NONE', variants: [] },
] as unknown as CatalogItem[];

function sale(status: 'OPEN' | 'FINALIZED' = 'OPEN', fulfillmentStatus: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' = 'WAITING', method: 'CASH' | 'BANK_TRANSFER' = 'CASH') {
  return {
    id: 'sale-1', saleNumber: 'TRX-1', currency: 'IDR', status, operationalState: 'IN_PROGRESS', version: 3,
    totalAmount: '100000.0000', payments: [{ id: 'payment-1', status: 'SUCCEEDED', method, appliedAmount: '100000.0000', tenderedAmount: null, changeAmount: null }],
    lines: [{ id: 'source-line', saleId: 'sale-1', catalogItemId: 'source-item', itemNameSnapshot: 'Smoothing Curly', quantity: '1.0000', effectiveUnitPrice: '100000.0000', removedAt: null, fulfillment: { status: fulfillmentStatus } }],
  } as unknown as Sale;
}

type CorrectionPreview = (line: SaleLine, input: { lines: unknown[] }) => Promise<ReplaceLinePreview>;
const previewOf = (overrides: Partial<ReplaceLinePreview> = {}): ReplaceLinePreview => ({
  saleId: 'sale-1', saleVersion: 3, currency: 'IDR', currentTotalAmount: '100000.0000', correctedTotalAmount: '80000.0000',
  netSuccessfulPaidAmount: '80000.0000', remainingPaymentAmount: '0.0000', replacements: [], ...overrides,
});

function renderDialog(options: {
  sale?: Sale;
  canCorrectProgressedLine?: boolean;
  canRefundPayment?: boolean;
  correctResult?: Sale;
  items?: CatalogItem[];
  compensateResult?: Sale;
  compensateError?: Error;
  preview?: ReplaceLinePreview;
  previewError?: Error;
  correctError?: Error;
} = {}) {
  const onPreview = vi.fn<CorrectionPreview>(async () => options.preview ?? previewOf());
  const onCompensate = vi.fn(async () => {
    if (options.compensateError) throw options.compensateError;
    return options.compensateResult;
  });
  const onCorrect = vi.fn(async () => {
    if (options.correctError) throw options.correctError;
    return options.correctResult;
  });
  if (options.previewError) onPreview.mockRejectedValue(options.previewError);
  const loadConfiguratorState = vi.fn(async (item: CatalogItem) => ({
    item, variants: [], itemPrice: '100000.0000', locale: 'id-ID', currency: 'IDR',
  }));
  const loadCandidates = vi.fn(async () => ({ items: [] }));
  const view = render(<DeploymentBootstrapProvider config={bootstrap}><QueryClientProvider client={new QueryClient()}><DToastProvider><ReferenceOrderAdjustmentDialog sale={options.sale ?? sale()} items={options.items ?? items} locale="id-ID" isMutating={false} variantPicker={null} onClose={vi.fn()} onAdd={vi.fn()} onAddVariant={vi.fn()} onQuantity={vi.fn()} onRemove={vi.fn()} onCorrect={onCorrect} onPreview={onPreview} loadConfiguratorState={loadConfiguratorState} loadCandidates={loadCandidates} canCorrectProgressedLine={options.canCorrectProgressedLine ?? false} canRefundPayment={options.canRefundPayment ?? false} onCompensate={onCompensate} /></DToastProvider></QueryClientProvider></DeploymentBootstrapProvider>);
  return { onPreview, onCompensate, onCorrect, loadConfiguratorState, ...view };
}

function correctedSale(method: 'CASH' | 'BANK_TRANSFER' = 'CASH') {
  return { ...sale('OPEN', 'WAITING', method), version: 4, totalAmount: '80000.0000' } as Sale;
}

function compensatedSale() {
  const base = correctedSale();
  return { ...base, version: 5, payments: [...base.payments, { id: 'refund-1', status: 'SUCCEEDED', method: 'CASH', appliedAmount: '-20000.0000', tenderedAmount: null, changeAmount: null }] } as unknown as Sale;
}

/** Opens the correction and waits until the shared configuration of the current item is ready. */
async function openCorrection() {
  fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled).toBe(false),
  );
}

async function previewAndConfirm() {
  await openCorrection();
  fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
  await screen.findByLabelText('Dampak koreksi');
  fireEvent.change(screen.getByLabelText('Alasan koreksi'), { target: { value: 'Salah pilih layanan' } });
  fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi koreksi' }));
}

describe('ReferenceOrderAdjustmentDialog progressed correction', () => {
  afterEach(cleanup);
  it('keeps OPEN IN_PROGRESS sales eligible, while explaining missing progressed-line authorization without exposing a permission key', () => {
    renderDialog({ sale: sale('OPEN', 'IN_PROGRESS') });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    expect(screen.getByText('Koreksi setelah pengerjaan dimulai memerlukan pengguna yang berwenang.')).toBeTruthy();
    expect(screen.queryByText('sales:correct-progressed-line')).toBeNull();
  });

  it('allows an authorized progressed correction and warns that work history is retained', () => {
    renderDialog({ sale: sale('OPEN', 'COMPLETED'), canCorrectProgressedLine: true });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    expect(screen.getByText('Pengerjaan item ini sudah dimulai. Riwayat pengerjaan tetap disimpan setelah koreksi.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps WAITING lines on the ordinary correction path and hides correction for FINALIZED sales', () => {
    const { unmount } = renderDialog({ sale: sale('OPEN', 'WAITING') });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    expect(screen.getByText('Item saat ini')).toBeTruthy();
    unmount();
    renderDialog({ sale: sale('FINALIZED', 'COMPLETED'), canCorrectProgressedLine: true });
    expect(screen.queryByRole('button', { name: 'Koreksi item' })).toBeNull();
  });

  it('previews the remaining balance from Runtime, never a predicted overpayment, and offers no compensation before saving', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true, correctResult: correctedSale(), preview: previewOf({ remainingPaymentAmount: '25000.0000', netSuccessfulPaidAmount: '55000.0000' }) });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Sisa pembayaran')).toBeTruthy();
    expect(screen.queryByText('Kelebihan pembayaran')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kembalikan kelebihan pembayaran' })).toBeNull();
    expect(view.onCompensate).not.toHaveBeenCalled();
  });

  it('confirms the correction first, then offers the cash return from the persisted Sale and refreshes the settlement', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true, correctResult: correctedSale(), compensateResult: compensatedSale() });
    await previewAndConfirm();
    expect(await screen.findByText('Koreksi tersimpan.')).toBeTruthy();
    expect(view.onCorrect).toHaveBeenCalledTimes(1);
    expect(view.onCompensate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan kelebihan pembayaran' }));
    expect(view.onCompensate).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }), 'payment-1', '20000.0000');
    expect(await screen.findByText('Pembayaran sudah sesuai')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kembalikan kelebihan pembayaran' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Selesai' }));
    expect(screen.queryByText('Koreksi tersimpan.')).toBeNull();
  });

  it('offers no cash return when the persisted Sale is not overpaid', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true, correctResult: { ...sale('OPEN', 'WAITING', 'CASH'), version: 4 } as Sale });
    await previewAndConfirm();
    expect(await screen.findByText('Koreksi tersimpan.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kembalikan kelebihan pembayaran' })).toBeNull();
    expect(view.onCompensate).not.toHaveBeenCalled();
  });

  it('explains missing refund permission and provider confirmation from the persisted Sale, without raw Runtime codes', async () => {
    const noPermission = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: false, correctResult: correctedSale() });
    await previewAndConfirm();
    expect(await screen.findByText('Pengembalian dana memerlukan pengguna dengan izin pengembalian pembayaran.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kembalikan kelebihan pembayaran' })).toBeNull();
    noPermission.unmount();
    renderDialog({ sale: sale('OPEN', 'WAITING', 'BANK_TRANSFER'), canRefundPayment: true, correctResult: correctedSale('BANK_TRANSFER') });
    await previewAndConfirm();
    expect(await screen.findByText('Pengembalian pembayaran ini memerlukan konfirmasi dari penyedia pembayaran.')).toBeTruthy();
  });

  it('shows plain guidance instead of a raw Runtime code when the cash return fails', async () => {
    renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true, correctResult: correctedSale(), compensateError: new Error('SALE_PAYMENT_COMPENSATION_NOT_REQUIRED') });
    await previewAndConfirm();
    fireEvent.click(await screen.findByRole('button', { name: 'Kembalikan kelebihan pembayaran' }));
    expect(await screen.findByText('Pengembalian kelebihan pembayaran belum dapat diselesaikan. Muat ulang transaksi lalu coba lagi.')).toBeTruthy();
    expect(screen.queryByText(/SALE_PAYMENT_COMPENSATION_NOT_REQUIRED/)).toBeNull();
  });

  it('treats a corrected replacement following progressed source work as progressed, not as freely editable', () => {
    const base = sale('OPEN', 'COMPLETED');
    const source = { ...base.lines[0]!, id: 'source-line', removedAt: '2026-09-02T00:04:00.000Z' };
    const replacement = { ...base.lines[0]!, id: 'replacement-line', catalogItemId: 'replacement-item', itemNameSnapshot: 'Hair Color', fulfillment: null, workLineage: { sourceLineId: 'source-line', sourceItemName: 'Smoothing Curly', status: 'COMPLETED' } };
    renderDialog({ sale: { ...base, lines: [source, replacement] } as unknown as Sale });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    // Without progressed-line authorization, the corrected replacement is guarded like the worked line it follows.
    expect(screen.getByText('Koreksi setelah pengerjaan dimulai memerlukan pengguna yang berwenang.')).toBeTruthy();
    expect(screen.queryByText('Item saat ini')).toBeNull();
  });

  it('does not demand a variant for an item that offers none, even when its variant mode is REQUIRED', async () => {
    const requiredWithoutVariants = [
      { id: 'source-item', code: 'SRC', name: 'Smoothing Curly', variantSelectionMode: 'REQUIRED', variants: [] },
    ] as unknown as CatalogItem[];
    renderDialog({ items: requiredWithoutVariants });
    await openCorrection();
    expect(screen.queryByText('Pilih varian')).toBeNull();
  });

  it('presents the correction form with the shared item configuration and a way back to the adjustment', async () => {
    renderDialog({ sale: sale('OPEN', 'WAITING') });
    await openCorrection();
    // Ordinary integer quantities are not shown with meaningless trailing zeros.
    expect((screen.getByRole('textbox', { name: 'Jumlah' }) as HTMLInputElement).value).toBe('1');
    // The reason is multiline explanatory text and the replacement item is searchable.
    expect(screen.getByLabelText('Alasan koreksi').tagName).toBe('TEXTAREA');
    expect(screen.getByRole('combobox', { name: 'Item pengganti' })).toBeTruthy();
    // Preview stays a fresh requirement before confirmation.
    expect((screen.getByRole('button', { name: 'Konfirmasi koreksi' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Kembali' }));
    expect(screen.queryByText('Item saat ini')).toBeNull();
    expect(screen.getByRole('button', { name: 'Koreksi item' })).toBeTruthy();
  });
});

describe('ReferenceOrderAdjustmentDialog — full item configuration in a correction', () => {
  afterEach(cleanup);
  const twoWithAdditions = () => ({
    ...sale('OPEN', 'WAITING'),
    lines: [
      {
        id: 'source-line', saleId: 'sale-1', catalogItemId: 'source-item', catalogVariantId: null, itemNameSnapshot: 'Smoothing Curly',
        quantity: '1.0000', effectiveUnitPrice: '100000.0000', removedAt: null, fulfillment: { status: 'WAITING' },
        compositionComponents: [],
      },
    ],
  } as unknown as Sale);

  it('offers the shared configuration: quantity 2 opens one configuration per unit', async () => {
    renderDialog({ sale: twoWithAdditions() });
    await openCorrection();
    fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value: '2' } });
    expect(screen.getByRole('list', { name: 'Unit' })).toBeTruthy();
    expect(screen.getByText('Atur setiap unit')).toBeTruthy();
    expect(screen.getByRole('switch', { name: /Gunakan item tambahan/ })).toBeTruthy();
  });

  it('sends the configuration as replacement lines: identical units stay one line with the quantity', async () => {
    const view = renderDialog({ sale: twoWithAdditions() });
    await openCorrection();
    fireEvent.change(screen.getByRole('textbox', { name: 'Jumlah' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    await screen.findByLabelText('Dampak koreksi');
    expect(view.onPreview).toHaveBeenCalledTimes(1);
    expect(view.onPreview.mock.calls[0]![1]).toEqual({
      lines: [{ catalogItemId: 'source-item', quantity: '3' }],
    });
  });

  it('shows the Runtime-calculated replacement lines and totals in the impact, not a Web calculation', async () => {
    renderDialog({
      sale: twoWithAdditions(),
      preview: previewOf({
        correctedTotalAmount: '425000.0000',
        replacements: [
          { catalogItemId: 'i', itemName: 'Smoothing Curly', variantName: 'Curly', quantity: '1.0000', unitAmount: '210000.0000', grossAmount: '210000.0000', additions: [{ name: 'Addition A', quantity: '1.0000', unitPrice: '25000.0000', amount: '25000.0000' }] },
          { catalogItemId: 'i', itemName: 'Smoothing Curly', variantName: 'Curly', quantity: '1.0000', unitAmount: '215000.0000', grossAmount: '215000.0000', additions: [{ name: 'Addition B', quantity: '1.0000', unitPrice: '30000.0000', amount: '30000.0000' }] },
        ],
      }),
    });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    const impact = await screen.findByLabelText('Dampak koreksi');
    expect(impact.textContent).toContain('Addition A');
    expect(impact.textContent).toContain('Addition B');
    expect(impact.textContent).toContain('210.000');
    expect(impact.textContent).toContain('215.000');
    expect(impact.textContent).toContain('425.000');
    expect(impact.textContent).not.toContain('212.500');
  });

  it('names what is missing instead of a generic preview failure, and keeps a safe fallback for unknown errors', async () => {
    const { ApiError } = await import('@digvation/pos-api');
    renderDialog({ previewError: new ApiError(404, 'CATALOG_ITEM_NOT_FOUND', 'gone') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Item pengganti tidak lagi tersedia.')).toBeTruthy();
    cleanup();
    renderDialog({ previewError: new Error('boom') });
    await openCorrection();
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Koreksi tidak dapat dipratinjau. Muat ulang transaksi lalu coba lagi.')).toBeTruthy();
  });
});
