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

function renderDialog(options: { sale?: Sale; canCorrectProgressedLine?: boolean; canRefundPayment?: boolean } = {}) {
  const onPreview: CorrectionPreview = async () => ({ saleVersion: 3, currentTotalAmount: '100000.0000', correctedTotalAmount: '80000.0000', netSuccessfulPaidAmount: '100000.0000', remainingPaymentAmount: '0.0000', overpaymentAmount: '20000.0000' });
  const onCompensate = vi.fn(async () => undefined);
  const view = render(<DeploymentBootstrapProvider config={bootstrap}><DToastProvider><ReferenceOrderAdjustmentDialog sale={options.sale ?? sale()} items={items} locale="id-ID" isMutating={false} variantPicker={null} onClose={vi.fn()} onAdd={vi.fn()} onAddVariant={vi.fn()} onQuantity={vi.fn()} onRemove={vi.fn()} onCorrect={vi.fn(async () => undefined)} onPreview={onPreview} canCorrectProgressedLine={options.canCorrectProgressedLine ?? false} canRefundPayment={options.canRefundPayment ?? false} onCompensate={onCompensate} /></DToastProvider></DeploymentBootstrapProvider>);
  return { onPreview, onCompensate, ...view };
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

  it('shows authoritative overpayment compensation guidance for cash permission and provider confirmation', async () => {
    const cash = renderDialog({ sale: sale('OPEN', 'WAITING', 'CASH'), canRefundPayment: true });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Kelebihan pembayaran')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kembalikan kelebihan pembayaran' }));
    expect(cash.onCompensate).toHaveBeenCalledWith(expect.any(Object), 'payment-1', '20000.0000');
    cash.unmount();
    renderDialog({ sale: sale('OPEN', 'WAITING', 'BANK_TRANSFER'), canRefundPayment: true });
    fireEvent.click(screen.getByRole('button', { name: 'Koreksi item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lihat dampak' }));
    expect(await screen.findByText('Pengembalian pembayaran ini memerlukan konfirmasi dari penyedia pembayaran.')).toBeTruthy();
  });
});
