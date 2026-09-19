import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CompletedSaleSummary, Sale } from './cashier-transaction.types';
import {
  canReadCompletedSaleDetails,
  completedSaleSummary,
  presentableTransaction,
  queueEntryFor,
  restrictedQueueSummary,
} from './completed-sale-visibility';
import {
  ReferenceQueueCard,
  RestrictedCompletedQueueCard,
} from './components/replatformed-pos-workspace';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

function completedSale(): Sale {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-20260919-000042',
    invoiceNumber: 'INV-20260919-000042',
    sellingLocationId: 'location-1',
    currency: 'IDR',
    status: 'FINALIZED',
    operationalState: 'IN_PROGRESS',
    version: 4,
    grossAmount: '350000.0000',
    discountAmount: '0.0000',
    netPreTaxAmount: '350000.0000',
    taxAmount: '0.0000',
    totalAmount: '350000.0000',
    orderDiscountType: null,
    orderDiscountValue: null,
    orderDiscountReason: null,
    orderDiscountAmount: '0.0000',
    customer: { type: 'NON_MEMBER', referenceId: null, name: 'Rina', phoneE164: '+628123456789' },
    finalizedAt: '2026-09-19T03:00:00.000Z',
    voidedAt: null,
    createdAt: '2026-09-19T01:00:00.000Z',
    updatedAt: '2026-09-19T03:00:00.000Z',
    lines: [
      { id: 'line-1', removedAt: null },
      { id: 'line-2', removedAt: '2026-09-19T02:00:00.000Z' },
    ],
    payments: [{ id: 'payment-1', status: 'SUCCEEDED', appliedAmount: '350000.0000' }],
  } as unknown as Sale;
}

describe('completed sale visibility', () => {
  it('depends on the effective permission only', () => {
    expect(canReadCompletedSaleDetails(['sales:read', 'sales:read-completed'])).toBe(true);
    expect(canReadCompletedSaleDetails(['sales:read', 'payments:read'])).toBe(false);
  });

  it('summarizes a completed sale without any financial or contact field', () => {
    const summary = completedSaleSummary(completedSale());
    expect(summary).toEqual({
      visibility: 'SUMMARY',
      id: 'sale-1',
      saleNumber: 'TRX-20260919-000042',
      invoiceNumber: 'INV-20260919-000042',
      sellingLocationId: 'location-1',
      status: 'FINALIZED',
      operationalState: 'IN_PROGRESS',
      customer: { type: 'NON_MEMBER', name: 'Rina' },
      itemCount: 1,
      finalizedAt: '2026-09-19T03:00:00.000Z',
      createdAt: '2026-09-19T01:00:00.000Z',
      updatedAt: '2026-09-19T03:00:00.000Z',
    });
    expect(JSON.stringify(summary)).not.toMatch(/350000|628123456789/);
  });

  it('never carries a split payment breakdown into the restricted summary', () => {
    const split = {
      ...completedSale(),
      payments: [
        {
          id: 'payment-1',
          status: 'SUCCEEDED',
          method: 'BANK_TRANSFER',
          appliedAmount: '200000.0000',
          financeFinancialAccountNameSnapshot: 'BCA',
        },
        {
          id: 'payment-2',
          status: 'SUCCEEDED',
          method: 'CASH',
          appliedAmount: '150000.0000',
          financeFinancialAccountNameSnapshot: 'Kas Utama',
        },
      ],
    } as unknown as Sale;
    const summary = restrictedQueueSummary(split, false);
    expect(summary).toEqual(completedSaleSummary(split));
    expect(JSON.stringify(summary)).not.toMatch(/BCA|Kas Utama|BANK_TRANSFER|200000|150000/);
  });

  it('keeps only the summary in the queue cache for a restricted reader', () => {
    const sale = completedSale();
    expect(queueEntryFor(sale, true)).toBe(sale);
    expect(queueEntryFor(sale, false)).toEqual(completedSaleSummary(sale));
    const open = { ...sale, status: 'OPEN' } as Sale;
    expect(queueEntryFor(open, false)).toBe(open);
  });

  it('restricts every completed entry without the permission, even a cached full copy', () => {
    const sale = completedSale();
    expect(restrictedQueueSummary(sale, true)).toBeNull();
    expect(restrictedQueueSummary(sale, false)).toEqual(completedSaleSummary(sale));
    const summary = completedSaleSummary(sale);
    expect(restrictedQueueSummary(summary, true)).toBe(summary);
    expect(restrictedQueueSummary({ ...sale, status: 'OPEN' } as Sale, false)).toBeNull();
  });
});

describe('immediate completion receipt versus completed history', () => {
  it('shows a restricted operator the receipt of the completion they just performed', () => {
    const sale = completedSale();
    expect(presentableTransaction(sale, false, sale.id)).toBe(sale);
  });

  it('never shows a restricted operator a completed transaction outside that completion', () => {
    const sale = completedSale();
    expect(presentableTransaction(sale, false, null)).toBeNull();
    expect(presentableTransaction(sale, false, 'another-sale')).toBeNull();
  });

  it('keeps full access with the permission and for open work', () => {
    const sale = completedSale();
    expect(presentableTransaction(sale, true, null)).toBe(sale);
    const open = { ...sale, status: 'OPEN' } as Sale;
    expect(presentableTransaction(open, false, null)).toBe(open);
    expect(presentableTransaction(null, false, null)).toBeNull();
  });
});

describe('completed queue card', () => {
  const noop = () => {};

  it('without the permission shows no amount, detail or receipt, only Send receipt', () => {
    const summary: CompletedSaleSummary = completedSaleSummary(completedSale());
    const onSendReceipt = vi.fn();
    const { container } = render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <RestrictedCompletedQueueCard
          summary={summary}
          locale="id-ID"
          isSending={false}
          onSendReceipt={onSendReceipt}
        />
      </DeploymentBootstrapProvider>,
    );
    const card = within(container);
    expect(container.textContent).not.toMatch(/Rp|350\.000|350000/);
    expect(card.queryByText('Lihat detail')).toBeNull();
    expect(card.queryByText('Lihat struk')).toBeNull();
    expect(card.queryByRole('button', { name: /Aksi untuk|Actions for/ })).toBeNull();
    expect(card.getByText('Rina')).not.toBeNull();
    fireEvent.click(card.getByRole('button', { name: /Kirim struk ke customer/ }));
    expect(onSendReceipt).toHaveBeenCalledWith(summary);
  });

  it('with the permission keeps the amount, detail, receipt and send actions', () => {
    const sale = completedSale();
    const onSendReceipt = vi.fn();
    const { container } = render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReferenceQueueCard
          sale={sale}
          status="COMPLETED"
          locale="id-ID"
          issues={[]}
          onStartWork={noop}
          onAdjust={noop}
          onPay={noop}
          onCancel={noop}
          onView={noop}
          onViewReceipt={noop}
          onSendReceipt={onSendReceipt}
        />
      </DeploymentBootstrapProvider>,
    );
    const card = within(container);
    expect(container.textContent).toMatch(/350\.000/);
    fireEvent.click(card.getByRole('button', { name: /TRX-20260919-000042/ }));
    const menu = within(document.body);
    expect(menu.getByRole('menuitem', { name: /Lihat detail/ })).not.toBeNull();
    expect(menu.getByRole('menuitem', { name: /Lihat struk/ })).not.toBeNull();
    fireEvent.click(menu.getByRole('menuitem', { name: /Kirim struk ke customer/ }));
    expect(onSendReceipt).toHaveBeenCalledWith(sale);
  });
});
