import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Sale, SaleLine } from '../../transaction/model/cashier-transaction.types';
import { ReferenceQueueCard, RestrictedCompletedQueueCard } from './reference-queue-card';
import { useQueueGroups } from '../model/use-queue-groups';
import type { QueueStatus } from '../model/queue-status';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const noop = () => undefined;
const longCustomer = 'Rina Kusumawardhani Putri Pratiwi dari Cabang Balaraja Timur';

const addition = (name: string) =>
  ({ id: `c-${name}`, componentSource: 'SALE_SELECTED', itemNameSnapshot: name }) as NonNullable<
    SaleLine['compositionComponents']
  >[number];

const line = (overrides: Partial<SaleLine> = {}) =>
  ({
    id: 'line-1',
    removedAt: null,
    itemNameSnapshot: 'Potong Rambut',
    variantNameSnapshot: 'Panjang',
    quantity: '1.0000',
    fulfillmentBehaviorSnapshot: 'TRACKED',
    participations: [
      {
        saleId: 'sale-1',
        saleLineId: 'line-1',
        employeeId: 'emp-andi',
        assigned: true,
        shareRate: null,
      },
      {
        saleId: 'sale-1',
        saleLineId: 'line-1',
        employeeId: 'emp-citra',
        assigned: true,
        shareRate: null,
      },
    ],
    compositionComponents: [addition('Hair Spray'), addition('Pomade')],
    contributions: [],
    discountType: null,
    lineDiscountAmount: '0.0000',
    orderDiscountAllocationAmount: '0.0000',
    overrideAmount: null,
    ...overrides,
  }) as SaleLine;

const sale = (lines: SaleLine[], adjustments: Sale['adjustments'] = []) =>
  ({
    id: 'sale-1',
    saleNumber: 'TRX-20261021-000007',
    status: 'OPEN',
    operationalState: 'QUEUED',
    totalAmount: '290000.0000',
    customer: { type: 'NON_MEMBER', referenceId: null, name: longCustomer, phoneE164: null },
    createdAt: '2026-10-21T03:00:00.000Z',
    updatedAt: '2026-10-21T03:00:00.000Z',
    lines,
    adjustments,
    payments: [],
  }) as unknown as Sale;

function renderCard(
  value: Sale,
  {
    status = 'QUEUED',
    onResume,
    onCancel = noop,
    onPay = noop,
    canRefundCancel = false,
  }: {
    status?: QueueStatus;
    onResume?: (sale: Sale) => void;
    onCancel?: (sale: Sale) => void;
    onPay?: (sale: Sale) => void;
    canRefundCancel?: boolean;
  } = {},
) {
  const { container } = render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceQueueCard
        sale={value}
        status={status}
        locale="id-ID"
        issues={[]}
        onStartWork={noop}
        onAdjust={noop}
        canAdjust
        onPay={onPay}
        onCancel={onCancel}
        {...(onResume ? { onResume } : {})}
        canRefundCancel={canRefundCancel}
        onView={noop}
        onViewReceipt={noop}
        onSendReceipt={noop}
      />
    </DeploymentBootstrapProvider>,
  );
  return within(container);
}

const NOTE = /Diskon item hanya berlaku untuk harga item utama/;

afterEach(cleanup);

describe('compact queue card', () => {
  it('identifies the order: customer, number, main item and how many additions it carries', () => {
    const card = renderCard(sale([line()]));
    expect(card.getByText(longCustomer)).toBeTruthy();
    expect(card.getByText('TRX-20261021-000007')).toBeTruthy();
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.getByText(/\+ 2 tambahan/)).toBeTruthy();
  });

  it('leaves performers, addition names and discount notes to the transaction detail', () => {
    const card = renderCard(
      sale([
        line({
          discountType: 'PERCENTAGE',
          lineDiscountAmount: '20000.0000',
          orderDiscountAllocationAmount: '5000.0000',
        }),
      ]),
    );
    expect(card.queryByText(/Hair Spray/)).toBeNull();
    expect(card.queryByText(/emp-andi|Andi/)).toBeNull();
    expect(card.queryByText(NOTE)).toBeNull();
  });

  it('leads with the item that carries additions, whatever order the lines arrive in', () => {
    const card = renderCard(
      sale([
        line({
          id: 'line-product',
          itemNameSnapshot: 'Pomade',
          variantNameSnapshot: null,
          fulfillmentBehaviorSnapshot: 'INSTANT',
          compositionComponents: [],
        }),
        line(),
      ]),
    );
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.getByText(/\+ 2 tambahan/)).toBeTruthy();
    expect(card.queryByText('Pomade')).toBeNull();
  });

  it('shows no addition count for an item without additions', () => {
    const card = renderCard(sale([line({ compositionComponents: [] })]));
    expect(card.getByText('Potong Rambut')).toBeTruthy();
    expect(card.queryByText(/tambahan/)).toBeNull();
  });
});

const pomade = line({
  id: 'line-pomade',
  itemNameSnapshot: 'Pomade',
  variantNameSnapshot: null,
  quantity: '3.0000',
  fulfillmentBehaviorSnapshot: 'INSTANT',
  participations: [],
  compositionComponents: [],
});
const productSale = (overrides: Record<string, unknown>) =>
  ({
    ...sale([pomade]),
    operationalState: 'UNSUBMITTED',
    totalAmount: '120000.0000',
    ...overrides,
  }) as unknown as Sale;
const payment = (status: 'SUCCEEDED' | 'PENDING' | 'FAILED', appliedAmount: string) => ({
  id: `payment-${status}-${appliedAmount}`,
  status,
  method: 'CASH',
  appliedAmount,
});

describe('Product-only Sales in the queue', () => {
  it('shows a completed Product-only Sale with its own item and no work', () => {
    const card = renderCard(
      productSale({ status: 'FINALIZED', payments: [payment('SUCCEEDED', '120000.0000')] }),
      { status: 'COMPLETED' },
    );
    expect(card.getByText('Pomade')).toBeTruthy();
    expect(card.getByText('Selesai')).toBeTruthy();
    expect(card.getByText('Lunas')).toBeTruthy();
    expect(card.queryByText('Menunggu pelunasan')).toBeNull();
    expect(card.queryByText('Mulai pengerjaan')).toBeNull();
  });

  it('labels a partly paid Product-only Sale awaiting settlement and resumes that exact Sale', () => {
    const onResume = vi.fn();
    const onCancel = vi.fn();
    const awaiting = productSale({ payments: [payment('SUCCEEDED', '50000.0000')] });
    const card = renderCard(awaiting, { onResume, onCancel });
    expect(card.getByText('Pomade')).toBeTruthy();
    expect(card.getByText('Menunggu pelunasan')).toBeTruthy();
    expect(card.getByText('Bayar sebagian')).toBeTruthy();
    // It is not work: never shown as queued, never startable.
    expect(card.queryByText('Antrian')).toBeNull();
    expect(card.queryByText('Mulai pengerjaan')).toBeNull();
    expect(card.getByText(/Sisa: Rp\s?70\.000/)).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: 'Lanjutkan pembayaran' }));
    expect(onResume).toHaveBeenCalledWith(awaiting);

    // Cancelling after money was received and the queue balance shortcut are not offered.
    fireEvent.click(card.getByRole('button', { name: /Tindakan untuk/ }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Lanjutkan pembayaran' })).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: 'Batal' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Bayar sisa' })).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('offers refund-and-cancel for a Sale awaiting settlement only to an operator allowed to refund', () => {
    const awaiting = productSale({ payments: [payment('SUCCEEDED', '50000.0000')] });
    const onCancel = vi.fn();
    const card = renderCard(awaiting, { onResume: vi.fn(), onCancel, canRefundCancel: true });
    fireEvent.click(card.getByRole('button', { name: /Tindakan untuk/ }));
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Kembalikan dana & batalkan',
      }),
    );
    expect(onCancel).toHaveBeenCalledWith(awaiting);
    // Money is still held: neither a completed nor a cancelled badge.
    expect(card.queryByText('Selesai')).toBeNull();
    expect(card.queryByText('Dibatalkan')).toBeNull();
  });

  it('keeps the queued-work actions for a queued Sale', () => {
    const card = renderCard(sale([line()]), { onResume: vi.fn() });
    expect(card.queryByText('Menunggu pelunasan')).toBeNull();
    expect(card.queryByRole('button', { name: 'Lanjutkan pembayaran' })).toBeNull();
    fireEvent.click(card.getByRole('button', { name: /Tindakan untuk/ }));
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Batal' })).toBeTruthy();
  });
});

describe('queue groups with further awaiting-settlement pages', () => {
  it('adds loaded pages once, beside the first page, and lists a voided Product-only Sale as cancelled', () => {
    const at = (value: Sale, id: string) =>
      ({ ...value, id, sellingLocationId: 'loc-1' }) as unknown as Sale;
    const first = at(productSale({ payments: [payment('SUCCEEDED', '1000.0000')] }), 'first');
    const later = at(productSale({ payments: [payment('SUCCEEDED', '1000.0000')] }), 'later');
    const voided = at(productSale({ status: 'VOIDED', payments: [] }), 'voided');
    const groups = renderHook(() =>
      useQueueGroups({
        transactionsQuery: {
          data: { items: [first, voided], receiptDeliveries: {}, limit: 100, offset: 0 },
        } as never,
        isLocalDemo: false,
        queuedSaleEntries: [],
        workspace: { selectedLocationId: 'loc-1' },
        awaitingSettlementPages: [later],
      }),
    ).result.current.groups;
    expect(groups.QUEUED.map((s) => s.id)).toEqual(['first', 'later']);
    expect(groups.CANCELED.map((s) => s.id)).toEqual(['voided']);
  });
});

describe('queue groups', () => {
  const group = (items: Sale[]) =>
    renderHook(() =>
      useQueueGroups({
        transactionsQuery: {
          data: { items, receiptDeliveries: {}, limit: 100, offset: 0 },
        } as never,
        isLocalDemo: false,
        queuedSaleEntries: [],
        workspace: { selectedLocationId: 'loc-1' },
      }),
    ).result.current.groups;
  const at = (value: Sale, id: string) =>
    ({ ...value, id, sellingLocationId: 'loc-1' }) as unknown as Sale;

  it('lists awaiting settlement with the queued Sales and completed Product-only Sales as completed', () => {
    const groups = group([
      at(sale([line()]), 'queued'),
      at(productSale({ payments: [payment('SUCCEEDED', '50000.0000')] }), 'partial'),
      at(productSale({ payments: [payment('PENDING', '120000.0000')] }), 'pending'),
      at(
        productSale({ status: 'FINALIZED', payments: [payment('SUCCEEDED', '120000.0000')] }),
        'done',
      ),
      at(productSale({ payments: [] }), 'draft'),
      at(productSale({ payments: [payment('FAILED', '120000.0000')] }), 'failed'),
    ]);
    expect(groups.QUEUED.map((s) => s.id)).toEqual(['queued', 'partial', 'pending']);
    expect(groups.PROGRESS).toEqual([]);
    expect(groups.COMPLETED.map((s) => s.id)).toEqual(['done']);
    expect(groups.CANCELED).toEqual([]);
  });
});

describe('a completed Sale reversed afterwards', () => {
  const at = (value: Sale, id: string) =>
    ({ ...value, id, sellingLocationId: 'loc-1' }) as unknown as Sale;
  const refund = {
    id: 'refund-1',
    status: 'SUCCEEDED',
    method: 'CASH',
    kind: 'REFUND',
    appliedAmount: '-120000.0000',
  };
  const reversedSale = productSale({
    status: 'FINALIZED',
    payments: [payment('SUCCEEDED', '120000.0000'), refund],
    reversal: { reason: 'Komplain', reversedAt: '2026-10-21T05:00:00.000Z' },
  });
  const summary = (reversed: boolean, id: string) =>
    ({
      visibility: 'SUMMARY',
      id,
      saleNumber: `TRX-20261021-0000${id.length}`,
      invoiceNumber: null,
      sellingLocationId: 'loc-1',
      status: 'FINALIZED',
      operationalState: 'UNSUBMITTED',
      customer: null,
      itemCount: 1,
      reversed,
      finalizedAt: '2026-10-21T04:00:00.000Z',
      createdAt: '2026-10-21T03:00:00.000Z',
      updatedAt: '2026-10-21T05:00:00.000Z',
    }) as const;

  it('is listed once, under cancelled only, from the full Sale and the restricted summary alike', () => {
    const items = [
      at(reversedSale, 'reversed'),
      at(
        productSale({ status: 'FINALIZED', payments: [payment('SUCCEEDED', '120000.0000')] }),
        'done',
      ),
      at(productSale({ payments: [payment('SUCCEEDED', '50000.0000')] }), 'partial'),
      summary(true, 'summary-reversed'),
      summary(false, 'summary-done'),
    ];
    const groups = renderHook(() =>
      useQueueGroups({
        transactionsQuery: {
          data: { items, receiptDeliveries: {}, limit: 100, offset: 0 },
        } as never,
        isLocalDemo: false,
        queuedSaleEntries: [],
        workspace: { selectedLocationId: 'loc-1' },
      }),
    ).result.current.groups;
    expect(groups.CANCELED.map((s) => s.id)).toEqual(['reversed', 'summary-reversed']);
    expect(groups.COMPLETED.map((s) => s.id)).toEqual(['done', 'summary-done']);
    expect(groups.QUEUED.map((s) => s.id)).toEqual(['partial']);
    const listed = Object.values(groups).flat();
    expect(listed).toHaveLength(items.length);
  });

  it('reads as cancelled and refunded on its card, never as partly paid or due', () => {
    const card = renderCard(reversedSale, { status: 'CANCELED' });
    expect(card.getByText('Dibatalkan')).toBeTruthy();
    expect(card.getByText('Dikembalikan')).toBeTruthy();
    expect(card.queryByText('Bayar sebagian')).toBeNull();
    expect(card.queryByText('Lunas')).toBeNull();
    expect(card.queryByText(/Sisa/)).toBeNull();
    expect(card.queryByText('Selesai')).toBeNull();
  });

  it('shows a restricted reader the cancellation without any amount', () => {
    const { container } = render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <RestrictedCompletedQueueCard
          summary={summary(true, 'summary-reversed')}
          locale="id-ID"
          receiptDelivery={null}
          onSendReceipt={noop}
        />
      </DeploymentBootstrapProvider>,
    );
    const card = within(container);
    expect(card.getByText('Dibatalkan')).toBeTruthy();
    expect(card.queryByText('Selesai')).toBeNull();
    expect(container.textContent).not.toMatch(/Rp/);
  });
});
