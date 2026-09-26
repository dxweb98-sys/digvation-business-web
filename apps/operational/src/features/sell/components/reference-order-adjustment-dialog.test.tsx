import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation-labs/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

type CorrectionPreview = (line: SaleLine, input: { catalogItemId: string; catalogVariantId?: string; quantity: string }) => Promise<{ saleVersion: number; currentTotalAmount: string; correctedTotalAmount: string; netSuccessfulPaidAmount: string; remainingPaymentAmount: string; overpaymentAmount: string }>;

function renderDialog(options: {
  sale?: Sale;
  canCorrectProgressedLine?: boolean;
  canRefundPayment?: boolean;
  correctResult?: Sale;
  items?: CatalogItem[];
  compensateResult?: Sale;
  compensateError?: Error;
} = {}) {
  const onPreview: CorrectionPreview = async () => ({ saleVersion: 3, currentTotalAmount: '100000.0000', correctedTotalAmount: '80000.0000', netSuccessfulPaidAmount: '100000.0000', remainingPaymentAmount: '0.0000', overpaymentAmount: '20000.0000' });
  const onCompensate = vi.fn(async () => {
    if (options.compensateError) throw options.compensateError;
    return options.compensateResult;
  });
  const onCorrect = vi.fn(async () => options.correctResult);
  const view = render(<DeploymentBootstrapProvider config={bootstrap}><DToastProvider><ReferenceOrderAdjustmentDialog sale={options.sale ?? sale()} items={options.items ?? items} locale="id-ID" isMutating={false} variantPicker={null} onClose={vi.fn()} onAdd={vi.fn()} onAddVariant={vi.fn()} onQuantity={vi.fn()} onRemove={vi.fn()} onCorrect={onCorrect} onPreview={onPreview} canCorrectProgressedLine={options.canCorrectProgressedLine ?? false} canRefundPayment={options.canRefundPayment ?? false} onCompensate={onCompensate} /></DToastProvider></DeploymentBootstrapProvider>);
  return { onPreview, onCompensate, onCorrect, ...view };
}

function correctedSale(method: 'CASH' | 'BANK_TRANSFER' = 'CASH') {
  return { ...sale('OPEN', 'WAITING', method), version: 4, totalAmount: '80000.0000' } as Sale;
}

function compensatedSale() {
  const base = correctedSale();
  return { ...base, version: 5, payments: [...base.payments, { id: 'refund-1', status: 'SUCCEEDED', method: 'CASH', appliedAmount: '-20000.0000', tenderedAmount: null, changeAmount: null }] } as unknown as Sale;
}

async function previewAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
  await screen.findByText('Kelebihan pembayaran');
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

  it('treats a predicted overpayment as read-only information and never offers compensation before the correction is saved', async () => {
    const view = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true, correctResult: correctedSale() });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Kelebihan pembayaran')).toBeTruthy();
    expect(screen.getByText(/Setelah koreksi dikonfirmasi, .*20\.000.* perlu dikembalikan kepada pelanggan/)).toBeTruthy();
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

  it('does not demand a variant for an item that offers none, even when its variant mode is REQUIRED', () => {
    const requiredWithoutVariants = [
      { id: 'source-item', code: 'SRC', name: 'Smoothing Curly', variantSelectionMode: 'REQUIRED', variants: [] },
    ] as unknown as CatalogItem[];
    renderDialog({ items: requiredWithoutVariants });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    expect(screen.queryByText('Varian')).toBeNull();
    expect((screen.getByRole('button', { name: 'Lihat dampak' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('presents the correction form with canonical inputs and a way back to the adjustment', () => {
    renderDialog({ sale: sale('OPEN', 'WAITING') });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    // Ordinary integer quantities are not shown with meaningless trailing zeros.
    expect((screen.getByLabelText('Jumlah') as HTMLInputElement).value).toBe('1');
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
