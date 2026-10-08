import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Employee, Sale, SaleLine } from '../../transaction/model/cashier-transaction.types';
import { presentableTransaction } from '../../transaction/model/completed-sale-visibility';
import { ReceiptContent } from '../../receipt/receipt-content';
import { ReferenceTransactionDetail } from '../../transaction/ui/reference-transaction-detail';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

function runtimeQueueDetail(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-runtime-1',
    saleNumber: 'TRX-20260924-000197',
    invoiceNumber: 'INV-20260924-000197',
    sellingLocationId: 'location-1',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'QUEUED',
    version: 3,
    grossAmount: '200000.0000',
    discountAmount: '20000.0000',
    netPreTaxAmount: '180000.0000',
    taxAmount: '19580.0000',
    totalAmount: '197580.0000',
    orderDiscountType: null,
    orderDiscountValue: null,
    orderDiscountReason: null,
    orderDiscountAmount: '0.0000',
    adjustments: [],
    loyaltyRedemption: {
      membershipId: 'membership-1',
      points: '2',
      pointValue: '1000.0000',
      amount: '2000.0000',
    },
    customer: {
      type: 'MEMBER',
      referenceId: 'customer-1',
      name: 'Nida',
      phoneE164: '+628123456789',
    },
    finalizedAt: null,
    voidedAt: null,
    createdAt: '2026-09-24T02:00:00.000Z',
    updatedAt: '2026-09-24T02:15:00.000Z',
    lines: [
      {
        id: 'line-1',
        saleId: 'sale-runtime-1',
        catalogItemId: 'item-1',
        catalogVariantId: null,
        catalogPriceId: 'price-1',
        itemCodeSnapshot: 'SERV-HAIR-COLOR',
        itemNameSnapshot: 'Hair Color',
        itemTypeSnapshot: 'SERVICE',
        variantCodeSnapshot: null,
        variantNameSnapshot: 'Medium',
        fulfillmentBehaviorSnapshot: 'TRACKED',
        employeeAssignmentModeSnapshot: 'REQUIRED',
        allowEmployeeContributionSnapshot: false,
        defaultDurationMinutesSnapshot: 60,
        quantity: '1.0000',
        currency: 'IDR',
        resolvedUnitPrice: '200000.0000',
        effectiveUnitPrice: '200000.0000',
        overrideAmount: null,
        overrideReason: null,
        discountType: null,
        discountValue: null,
        discountReason: null,
        grossAmount: '200000.0000',
        lineDiscountAmount: '0.0000',
        orderDiscountAllocationAmount: '0.0000',
        discountedCustomerBaseAmount: '200000.0000',
        includedTaxAmount: '0.0000',
        excludedTaxAmount: '19580.0000',
        netPreTaxAmount: '180000.0000',
        taxAmount: '19580.0000',
        totalAmount: '197580.0000',
        removedAt: null,
        createdAt: '2026-09-24T02:00:00.000Z',
        updatedAt: '2026-09-24T02:15:00.000Z',
        fulfillment: {
          saleId: 'sale-runtime-1',
          saleLineId: 'line-1',
          status: 'WAITING',
          startedAt: null,
          completedAt: null,
          canceledAt: null,
        },
        participations: [],
        contributions: [],
        workUnits: [],
      },
    ],
    payments: [
      {
        id: 'payment-1',
        saleId: 'sale-runtime-1',
        method: 'CASH',
        status: 'SUCCEEDED',
        currency: 'IDR',
        appliedAmount: '197580.0000',
        tenderedAmount: '200000.0000',
        changeAmount: '2420.0000',
        providerReference: null,
        financeFinancialAccountNameSnapshot: 'Kas Utama',
        idempotencyKey: 'payment-key-1',
        createdByActorId: 'cashier-1',
        createdByActorKind: 'USER',
        settledByActorId: 'cashier-1',
        settledByActorKind: 'USER',
        terminalAt: '2026-09-24T02:15:00.000Z',
        createdAt: '2026-09-24T02:15:00.000Z',
        updatedAt: '2026-09-24T02:15:00.000Z',
      },
    ],
    ...overrides,
  };
}

function renderRuntimeDetail(
  sale: Sale,
  delivery?: { status: 'SENT' | 'FAILED'; onOpenDelivery: (sale: Sale) => void },
  showPaymentReceipt = false,
  onStartLineWork: (line: SaleLine) => void = vi.fn(),
  branchAddress: string | null = null,
) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceTransactionDetail
        sale={sale}
        locale="id-ID"
        employees={[]}
        businessName="Digvation"
        branchName="Main branch"
        branchAddress={branchAddress}
        cashierName="Kasir"
        showPaymentReceipt={showPaymentReceipt}
        onClose={vi.fn()}
        onNewSale={vi.fn()}
        onViewReceipt={vi.fn()}
        onAssign={vi.fn()}
        onStartLineWork={onStartLineWork}
        onComplete={vi.fn()}
        isMutating={false}
        {...(delivery
          ? {
              deliveryStatus: {
                available: true,
                delivery: { status: delivery.status },
              },
              onSendReceipt: delivery.onOpenDelivery,
            }
          : {})}
      />
    </DeploymentBootstrapProvider>,
  );
}

function setLineLoyaltyEarning(
  sale: Sale,
  loyaltyEarning: NonNullable<Sale['lines'][number]['loyaltyEarning']>,
) {
  const line = sale.lines[0];
  if (!line) throw new Error('Runtime fixture requires one Sale line');
  line.loyaltyEarning = loyaltyEarning;
}

describe('ReferenceTransactionDetail Runtime detail shapes', () => {
  it.each([
    ['OPEN queue Sale', { operationalState: 'QUEUED' as const }],
    ['IN_PROGRESS Sale', { operationalState: 'IN_PROGRESS' as const }],
  ])('renders Runtime loyalty redemption for an $s', (_state, overrides) => {
    renderRuntimeDetail(runtimeQueueDetail(overrides));

    expect(screen.getAllByText('Hair Color').length).toBeGreaterThan(0);
    expect(screen.getByText('Nida')).toBeTruthy();
    expect(screen.getByText('Penggunaan poin')).toBeTruthy();
    expect(screen.getByText(/2 poin digunakan/)).toBeTruthy();
    expect(screen.getByText('Kas Utama')).toBeTruthy();
    expect(screen.getAllByText(/197[.,]580/).length).toBeGreaterThan(0);
  });

  it('renders the full finalized Sale returned for an authorized completed detail', () => {
    const completed = runtimeQueueDetail({
      status: 'FINALIZED',
      operationalState: 'IN_PROGRESS',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
    });
    setLineLoyaltyEarning(completed, {
      state: 'FINALIZED',
      pointsEarned: '2.0000',
    });
    const presentable = presentableTransaction(completed, true, null);

    expect(presentable).toBe(completed);
    renderRuntimeDetail(presentable!);
    expect(screen.getByText('Hair Color')).toBeTruthy();
    expect(screen.getByText('Poin diperoleh: +2 poin')).toBeTruthy();
    expect(screen.queryByText('Penggunaan poin')).toBeNull();
    expect(screen.getByText('Kas Utama')).toBeTruthy();
    expect(screen.getAllByText(/197[.,]580/).length).toBeGreaterThan(0);
  });

  it('renders Runtime preview points for Open work without treating them as earned history', () => {
    const open = runtimeQueueDetail({ loyaltyRedemption: null });
    setLineLoyaltyEarning(open, {
      state: 'PREVIEW',
      pointsEarned: '6.0000',
    });

    renderRuntimeDetail(open);

    expect(screen.getByText('Perkiraan poin: +6 poin')).toBeTruthy();
    expect(screen.queryByText('Poin diperoleh: +6 poin')).toBeNull();
  });

  it('stacks the customer, then the historical member point summary, on the receipt', () => {
    const completed = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: {
        membershipId: 'membership-1',
        points: '3.0000',
        pointValue: '1000.0000',
        amount: '3000.0000',
      },
    });
    (
      completed as Sale & {
        loyaltySummary: {
          earnedPoints: string;
          redeemedPoints: string;
          balanceAfter: string;
        };
      }
    ).loyaltySummary = {
      earnedPoints: '5.0000',
      redeemedPoints: '3.0000',
      balanceAfter: '122.0000',
    };

    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={completed}
          activeLines={completed.lines}
          customer={completed.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );

    const header = screen.getByText('Nida').closest('section')!;
    const points = within(header).getByTestId('receipt-points');
    // Customer identity first, then the point block below it: never side by side.
    expect(
      screen.getByText('Nida').compareDocumentPosition(points) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(points).getByText('Poin')).toBeTruthy();
    expect(within(points).getByText('Saldo')).toBeTruthy();
    expect(within(points).getByText('122')).toBeTruthy();
    expect(within(points).getByText('Diperoleh')).toBeTruthy();
    expect(within(points).getByText('+5')).toBeTruthy();
    expect(within(points).getByText('Digunakan')).toBeTruthy();
    expect(within(points).getByText('−3')).toBeTruthy();
    // "Poin saat ini" would read as today's balance; this is the balance right after this Sale.
    expect(screen.queryByText('Poin saat ini')).toBeNull();
  });

  it('states the earned points once, from the loyalty summary, without a second total row', () => {
    const completed = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
      loyaltyEarning: { state: 'FINALIZED', pointsEarned: '3.0000' },
    } as Partial<Sale>);
    (completed as Sale).loyaltySummary = {
      earnedPoints: '3.0000',
      redeemedPoints: '0.0000',
      balanceAfter: '3.0000',
    };
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={completed}
          activeLines={completed.lines}
          customer={completed.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );
    const header = screen.getByText('Nida').closest('section')!;
    expect(within(header).getAllByText('+3')).toHaveLength(1);
    expect(within(header).queryByText('Poin diperoleh')).toBeNull();
    expect(within(header).queryByText('Digunakan')).toBeNull();
    expect(screen.queryByTestId('receipt-points-earned')).toBeNull();
  });

  it('shows no point summary for a non-member customer', () => {
    const completed = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
    });
    (completed as Sale).customer = {
      type: 'NON_MEMBER',
      referenceId: null,
      name: 'Alex',
      phoneE164: '+6285966356803',
    };
    (completed as Sale).loyaltySummary = {
      earnedPoints: '3.0000',
      redeemedPoints: '0.0000',
      balanceAfter: '3.0000',
    };
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={completed}
          activeLines={completed.lines}
          customer={completed.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('+6285966356803')).toBeTruthy();
    expect(screen.queryByTestId('receipt-points')).toBeNull();
  });

  it('uses only finalized Runtime snapshot points on the receipt', () => {
    const completed = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
    });
    setLineLoyaltyEarning(completed, {
      state: 'FINALIZED',
      pointsEarned: '6.0000',
    });
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={completed}
          activeLines={completed.lines}
          customer={completed.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );

    expect(screen.getByText('Poin diperoleh')).toBeTruthy();
    expect(screen.getByText('+6')).toBeTruthy();
  });

  it('omits positive earning text for redeemed and legacy finalized Sales', () => {
    const redeemed = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
    });
    renderRuntimeDetail(redeemed);

    expect(screen.queryByText(/Poin diperoleh:/)).toBeNull();
    cleanup();
    const legacy = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
    });
    renderRuntimeDetail(legacy);

    expect(screen.queryByText(/Poin diperoleh:/)).toBeNull();
  });

  it('keeps a cancelled Runtime payment out of successful payment composition', () => {
    const payment = runtimeQueueDetail().payments[0];
    if (!payment) throw new Error('Runtime fixture requires one Payment');
    const cancelledAttempt = {
      ...payment,
      status: 'CANCELLED' as const,
      appliedAmount: '252303.0000',
    };
    renderRuntimeDetail(runtimeQueueDetail({ payments: [cancelledAttempt] }));

    expect(screen.getByRole('heading', { name: 'Percobaan pembayaran' })).toBeTruthy();
    expect(screen.getByText('Dibatalkan')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pembayaran' })).toBeNull();
    expect(screen.getAllByText(/Rp\s*0/).length).toBeGreaterThan(0);
  });

  it('makes a failed receipt delivery visible and opens the shared delivery flow to retry', () => {
    const onOpenDelivery = vi.fn();
    const sale = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
    });

    renderRuntimeDetail(sale, { status: 'FAILED', onOpenDelivery }, true);

    const retry = screen.getByRole('button', { name: 'Gagal · Coba lagi' });
    retry.click();
    // The preview never sends by itself: it hands the Sale to the one receipt-delivery flow.
    expect(onOpenDelivery).toHaveBeenCalledTimes(1);
    expect(onOpenDelivery).toHaveBeenCalledWith(sale);
  });

  it('keeps an accepted send resendable and never claims delivery', () => {
    const sale = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
    });

    renderRuntimeDetail(sale, { status: 'SENT', onOpenDelivery: vi.fn() }, true);

    const resend = screen.getByRole('button', { name: 'Kirim ulang WhatsApp' });
    expect(resend.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('Terkirim')).toBeNull();
  });
});

describe('ReferenceTransactionDetail opening and closing', () => {
  const detail = (sale: Sale | null) => (
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceTransactionDetail
        sale={sale}
        locale="id-ID"
        employees={[]}
        businessName="Digvation"
        branchName="Main branch"
        cashierName="Kasir"
        showPaymentReceipt={false}
        onClose={vi.fn()}
        onNewSale={vi.fn()}
        onViewReceipt={vi.fn()}
        onAssign={vi.fn()}
        onStartLineWork={vi.fn()}
        onComplete={vi.fn()}
        isMutating={false}
      />
    </DeploymentBootstrapProvider>
  );

  it('keeps the closing dialog and its Sale, then shows the next Sale in a fresh dialog', () => {
    vi.useFakeTimers();
    try {
      const first = runtimeQueueDetail();
      const { rerender } = render(detail(first));
      const opened = screen.getByRole('dialog');

      rerender(detail(null));
      expect(screen.getByRole('dialog')).toBe(opened);
      expect(screen.getByRole('dialog').textContent).toContain('TRX-20260924-000197');

      act(() => vi.advanceTimersByTime(300));
      expect(screen.queryByRole('dialog')).toBeNull();

      rerender(
        detail(runtimeQueueDetail({ id: 'sale-runtime-2', saleNumber: 'TRX-20260924-000198' })),
      );
      expect(screen.getByRole('dialog').textContent).toContain('TRX-20260924-000198');
    } finally {
      vi.useRealTimers();
    }
  });

  /** What the workspace passes: receipt mode, branch and delivery all derive from the shown Sale. */
  const receipt = (sale: Sale | null, branchName: string) => (
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceTransactionDetail
        sale={sale}
        locale="id-ID"
        employees={[]}
        businessName="Digvation"
        branchName={branchName}
        branchAddress={sale ? `Jl. ${branchName}` : null}
        cashierName="Kasir"
        showPaymentReceipt={sale !== null}
        onClose={vi.fn()}
        onNewSale={vi.fn()}
        onViewReceipt={vi.fn()}
        onAssign={vi.fn()}
        onStartLineWork={vi.fn()}
        onComplete={vi.fn()}
        isMutating={false}
        onSendReceipt={vi.fn()}
        {...(sale
          ? { deliveryStatus: { available: true, delivery: { status: 'SENT' as const } } }
          : {})}
      />
    </DeploymentBootstrapProvider>
  );
  const finalized = (overrides: Partial<Sale> = {}) =>
    runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      ...overrides,
    });

  it('keeps the closing receipt exactly as shown until it has left, then opens the next one live', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(receipt(finalized(), 'Cabang Utara'));
      const opened = screen.getByRole('dialog');
      const shown = opened.textContent;
      expect(screen.getByRole('heading', { name: 'Pratinjau struk' })).toBeTruthy();

      // Closing clears the Sale and everything derived from it in one batch.
      rerender(receipt(null, 'Cabang utama'));
      expect(screen.getByRole('dialog')).toBe(opened);
      expect(screen.getByRole('dialog').textContent).toBe(shown);
      expect(screen.getByRole('heading', { name: 'Pratinjau struk' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Kirim ulang WhatsApp' })).toBeTruthy();

      act(() => vi.advanceTimersByTime(300));
      expect(screen.queryByRole('dialog')).toBeNull();

      // The next receipt shows its own values in the opening render, never the retained ones.
      rerender(
        receipt(
          finalized({ id: 'sale-runtime-2', saleNumber: 'TRX-20260924-000198' }),
          'Cabang Selatan',
        ),
      );
      const next = screen.getByRole('dialog').textContent;
      expect(next).toContain('TRX-20260924-000198');
      expect(next).toContain('Cabang Selatan');
      expect(next).not.toContain('Cabang Utara');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ReferenceTransactionDetail receipt location identity', () => {
  const finalizedWithPayment = () =>
    runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
    });

  it('renders the resolved selling-location address under the branch name', () => {
    renderRuntimeDetail(
      finalizedWithPayment(),
      undefined,
      true,
      undefined,
      'Jl. Alam Sutera Boulevard No. 10',
    );

    expect(screen.getAllByText('Jl. Alam Sutera Boulevard No. 10').length).toBeGreaterThan(0);
  });

  it('never prints a fake or placeholder address line when none is configured', () => {
    renderRuntimeDetail(finalizedWithPayment(), undefined, true, undefined, null);

    expect(screen.queryByText(/Alamat belum diatur/i)).toBeNull();
    expect(screen.queryByText(/^Jl\./)).toBeNull();
  });

  it('does not render an address line for whitespace-only address input', () => {
    renderRuntimeDetail(finalizedWithPayment(), undefined, true, undefined, '   ');

    for (const branch of screen.getAllByText('Main branch')) {
      expect(branch.closest('header')!.querySelector('p.mt-0\\.5')).toBeNull();
    }
  });
});

describe('ReferenceTransactionDetail performer relationship', () => {
  const people = [
    { id: 'emp-andini', code: 'AND', displayName: 'Andini', status: 'ACTIVE' },
    { id: 'emp-rindu', code: 'RIN', displayName: 'Rindu Putri', status: 'ACTIVE' },
    { id: 'emp-sari', code: 'SAR', displayName: 'Sari', status: 'ACTIVE' },
  ] as unknown as Employee[];

  function withPerformers(): Sale {
    const base = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    const template = base.lines[0]!;
    const participation = (lineId: string, employeeId: string) => ({
      saleId: base.id,
      saleLineId: lineId,
      employeeId,
      assigned: true,
      shareRate: '1.000000000000000000',
    });
    const unit = (unitNumber: number, ...employeeIds: string[]) => ({
      unitNumber,
      employeeIds,
      performers: employeeIds.map((employeeId) => ({ employeeId, shareRate: null })),
    });
    const service = (id: string, name: string, quantity: string) => ({
      ...template,
      id,
      itemNameSnapshot: name,
      variantNameSnapshot: null,
      quantity,
      participations: [],
      workUnits: [],
    });
    return {
      ...base,
      lines: [
        {
          ...service('line-color', 'Hair Color', '2.0000'),
          participations: [
            participation('line-color', 'emp-andini'),
            participation('line-color', 'emp-rindu'),
          ],
          workUnits: [unit(1, 'emp-andini'), unit(2, 'emp-rindu')],
        },
        {
          ...service('line-curly', 'Smoothing Curly', '1.0000'),
          participations: [participation('line-curly', 'emp-sari')],
        },
        service('line-bleach', 'Body Bleaching', '1.0000'),
        {
          ...service('line-same', 'Facial Treatment', '2.0000'),
          participations: [participation('line-same', 'emp-andini')],
          workUnits: [unit(1, 'emp-andini'), unit(2, 'emp-andini')],
        },
        {
          ...service('line-shared', 'Creambath', '1.0000'),
          participations: [
            participation('line-shared', 'emp-andini'),
            participation('line-shared', 'emp-rindu'),
          ],
          workUnits: [unit(1, 'emp-andini', 'emp-rindu')],
        },
      ],
    } as unknown as Sale;
  }

  function renderDetail(onAssign: (line: SaleLine) => void = vi.fn()) {
    return render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReferenceTransactionDetail
          sale={withPerformers()}
          locale="id-ID"
          employees={people}
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          showPaymentReceipt={false}
          onClose={vi.fn()}
          onNewSale={vi.fn()}
          onViewReceipt={vi.fn()}
          onAssign={onAssign}
          onStartLineWork={vi.fn()}
          onComplete={vi.fn()}
          isMutating={false}
        />
      </DeploymentBootstrapProvider>,
    );
  }

  const groupOf = (name: RegExp) => screen.getByRole('group', { name });

  it('ties each unit of a quantity-2 service to its own performer, in a structured list', () => {
    renderDetail();
    const color = groupOf(/Hair Color/);
    expect(within(color).getByText(/Pengerjaan 1/)).toBeTruthy();
    expect(within(color).getByText('Andini')).toBeTruthy();
    expect(within(color).getByText(/Pengerjaan 2/)).toBeTruthy();
    expect(within(color).getByText('Rindu Putri')).toBeTruthy();
  });

  it('keeps a single performer compact: only the name, no unit numbering, no other performers', () => {
    renderDetail();
    const curly = groupOf(/Smoothing Curly/);
    expect(within(curly).getByText('Sari')).toBeTruthy();
    expect(within(curly).queryByText(/Pengerjaan/)).toBeNull();
    expect(within(curly).queryByText('Andini')).toBeNull();
  });

  it('summarises the same performer on every unit instead of repeating the name', () => {
    renderDetail();
    const same = groupOf(/Facial Treatment/);
    expect(within(same).getAllByText('Andini')).toHaveLength(1);
    expect(within(same).getByText(/Semua pengerjaan/)).toBeTruthy();
    expect(within(same).queryByText(/Pengerjaan \d/)).toBeNull();
  });

  it('shows several contributors on ONE unit as shared work, distinct from a quantity of two', () => {
    renderDetail();
    const shared = groupOf(/Creambath/);
    expect(within(shared).getByText('Andini')).toBeTruthy();
    expect(within(shared).getByText('Rindu Putri')).toBeTruthy();
    expect(within(shared).getByText(/Dikerjakan bersama/)).toBeTruthy();
    // Not presented as two separate work units.
    expect(within(shared).queryByText(/Pengerjaan \d/)).toBeNull();
    expect(within(shared).queryByText(/Semua pengerjaan/)).toBeNull();
  });

  it('makes a missing performer clear and actionable, with the action beside the item status', () => {
    renderDetail();
    const bleach = groupOf(/Body Bleaching/);
    expect(within(bleach).getByText('Belum ada karyawan')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pilih karyawan: Body Bleaching/ })).toBeTruthy();
    // Services that already have performers offer a plain change action.
    expect(screen.getByRole('button', { name: /Ubah karyawan: Hair Color/ })).toBeTruthy();
  });

  it('edits exactly the item whose action was clicked', () => {
    const onAssign = vi.fn();
    renderDetail(onAssign);
    fireEvent.click(screen.getByRole('button', { name: /Ubah karyawan: Hair Color/ }));
    expect(onAssign).toHaveBeenCalledTimes(1);
    expect((onAssign.mock.calls[0]![0] as SaleLine).itemNameSnapshot).toBe('Hair Color');
    fireEvent.click(screen.getByRole('button', { name: /Pilih karyawan: Body Bleaching/ }));
    expect(onAssign).toHaveBeenCalledTimes(2);
    expect((onAssign.mock.calls[1]![0] as SaleLine).itemNameSnapshot).toBe('Body Bleaching');
  });
});

describe('ReferenceTransactionDetail selected additions', () => {
  type Usage = NonNullable<SaleLine['compositionComponents']>[number];
  const usage = (overrides: Partial<Usage> & { id: string; itemNameSnapshot: string }): Usage => ({
    position: 0,
    componentSource: 'FIXED_BOM',
    fixedBomSource: 'SERVICE_DEFAULT',
    componentItemId: 'product',
    componentVariantId: null,
    itemCodeSnapshot: 'P',
    variantCodeSnapshot: null,
    variantNameSnapshot: null,
    quantity: '1.0000',
    pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
    // Present on purpose: a fixed BOM snapshot price must never surface.
    transactionUnitPrice: '88888.0000',
    catalogPriceId: null,
    unitContribution: '0.0000',
    extendedContribution: '0.0000',
    ...overrides,
  });
  const developer = usage({ id: 'u-dev', itemNameSnapshot: 'Developer 20 vol' });
  const redBrand = usage({
    id: 'u-red',
    itemNameSnapshot: 'Red Coloring Brand',
    variantNameSnapshot: 'Intense',
    componentSource: 'SALE_SELECTED',
    fixedBomSource: null,
    pricingMode: 'FOLLOW_PRODUCT_PRICE',
    transactionUnitPrice: '10000.0000',
    unitContribution: '10000.0000',
    extendedContribution: '10000.0000',
    position: 1,
  });

  /** Hair Color line: base 200.000 + one 10.000 addition = 210.000 per unit. */
  const withUsage = (components: Usage[], quantity = '1.0000') => {
    const sale = runtimeQueueDetail();
    const line = sale.lines[0]!;
    const additionUnit = components
      .filter((component) => component.componentSource === 'SALE_SELECTED')
      .reduce((sum, component) => sum + Number(component.extendedContribution), 0);
    line.compositionComponents = components;
    line.quantity = quantity;
    line.effectiveUnitPrice = (200000 + additionUnit).toFixed(4);
    line.grossAmount = ((200000 + additionUnit) * Number(quantity)).toFixed(4);
    return sale;
  };
  const additionsList = () => screen.getByRole('list', { name: 'Item tambahan' });

  it('explains the line as base + selected additions, and never lists fixed BOM', () => {
    renderRuntimeDetail(withUsage([developer, redBrand]));

    const rows = within(additionsList()).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // Base first, then the addition attached to its parent line.
    expect(within(rows[0]!).getByText('Harga item')).toBeTruthy();
    expect(rows[0]!.textContent).toContain('200.000');
    expect(rows[1]!.textContent).toContain('+ Red Coloring Brand / Intense');
    expect(rows[1]!.textContent).toContain('1 × Rp 10.000');
    expect(rows[1]!.textContent).toContain('10.000');
    expect(additionsList().closest('li.pos-line-item')?.textContent).toContain('Hair Color');
    // The line total stays the line amount (200.000 + 10.000).
    expect(additionsList().closest('li.pos-line-item')?.textContent).toContain('210.000');
    expect(document.body.textContent).not.toContain('Developer 20 vol');
    expect(document.body.textContent).not.toMatch(/88[.,]888/);
  });

  it('shows nothing for a line that only has fixed BOM components, or none', () => {
    const { unmount } = renderRuntimeDetail(withUsage([developer]));
    expect(screen.queryByText('Item tambahan')).toBeNull();
    expect(document.body.textContent).not.toContain('Developer 20 vol');
    unmount();
    renderRuntimeDetail(withUsage([]));
    expect(screen.queryByText('Item tambahan')).toBeNull();
  });

  it('applies the line quantity exactly once: base + additions still equals the line amount', () => {
    const sale = withUsage([redBrand], '2.0000');
    const second = {
      ...structuredClone(sale.lines[0]!),
      id: 'line-2',
      itemNameSnapshot: 'Highlight',
    };
    second.compositionComponents = [];
    sale.lines.push(second);
    renderRuntimeDetail(sale);

    const lists = screen.getAllByRole('list', { name: 'Item tambahan' });
    expect(lists).toHaveLength(1);
    const rows = within(lists[0]!).getAllByRole('listitem');
    // 2 x 200.000 = 400.000 base, 2 x 10.000 = 20.000 addition, 420.000 line.
    expect(rows[0]!.textContent).toContain('400.000');
    expect(rows[1]!.textContent).toContain('2 × ');
    expect(rows[1]!.textContent).toContain('20.000');
    expect(lists[0]!.closest('li.pos-line-item')?.textContent).toContain('420.000');
    expect(lists[0]!.closest('li.pos-line-item')?.textContent).not.toContain('Highlight');
  });

  it('shows the selected additions on the customer receipt as a breakdown, never fixed BOM', () => {
    const sale = withUsage([developer, redBrand]);
    sale.status = 'FINALIZED';
    sale.finalizedAt = '2026-09-24T02:15:00.000Z';
    sale.loyaltyRedemption = null;
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={sale}
          activeLines={sale.lines}
          customer={sale.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );
    expect(screen.getByText(/\+ Red Coloring Brand \/ Intense/)).toBeTruthy();
    expect(screen.queryByText(/Developer 20 vol/)).toBeNull();
    expect(screen.queryByText(/Digunakan/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/88[.,]888/);
    expect(document.body.textContent).toContain('210.000');
  });

  it('keeps units with different additions apart: each line lists only its own addition with exact amounts', () => {
    const sale = withUsage([redBrand]);
    const second = structuredClone(sale.lines[0]!);
    second.id = 'line-2';
    second.effectiveUnitPrice = '215000.0000';
    second.grossAmount = '215000.0000';
    second.compositionComponents = [
      {
        ...redBrand,
        id: 'u-blue',
        itemNameSnapshot: 'Blue Toner',
        variantNameSnapshot: null,
        transactionUnitPrice: '15000.0000',
        unitContribution: '15000.0000',
        extendedContribution: '15000.0000',
      },
    ];
    sale.lines.push(second);
    renderRuntimeDetail(sale);

    const lists = screen.getAllByRole('list', { name: 'Item tambahan' });
    expect(lists).toHaveLength(2);
    expect(lists[0]!.textContent).toContain('Red Coloring Brand / Intense');
    expect(lists[0]!.textContent).not.toContain('Blue Toner');
    expect(lists[1]!.textContent).toContain('Blue Toner');
    expect(lists[1]!.textContent).not.toContain('Red Coloring');
    // Both lines reconcile: 200.000 + 10.000 and 200.000 + 15.000, never an averaged 212.500.
    expect(lists[0]!.closest('li.pos-line-item')?.textContent).toContain('210.000');
    expect(lists[1]!.closest('li.pos-line-item')?.textContent).toContain('215.000');
    expect(document.body.textContent).not.toContain('212.500');
  });
});

describe('ReferenceTransactionDetail discounts and promotions', () => {
  const adjustment = (id: string, overrides: Record<string, unknown>) => ({
    id,
    source: 'PROMOTION',
    scope: 'ITEM',
    type: 'PERCENTAGE',
    configuredValue: '0.1000',
    requestedValue: null,
    actualAmount: '0.0000',
    promotionId: 'promo-kilat',
    promotionEffectiveFrom: '2026-09-01T00:00:00.000Z',
    promotionEffectiveUntil: '2026-09-30T00:00:00.000Z',
    label: 'kilat',
    saleLineId: null,
    actorId: null,
    actorKind: null,
    reason: null,
    createdAt: '2026-09-24T02:00:00.000Z',
    ...overrides,
  });
  const twoLines = () => {
    const sale = runtimeQueueDetail();
    const second = structuredClone(sale.lines[0]!);
    second.id = 'line-2';
    second.itemNameSnapshot = 'Hair Color Two';
    sale.lines.push(second);
    sale.adjustments = [
      adjustment('a1', { saleLineId: 'line-1', actualAmount: '22000.0000' }),
      adjustment('a2', { saleLineId: 'line-2', actualAmount: '21200.0000' }),
      adjustment('a3', {
        scope: 'TRANSACTION',
        promotionId: 'promo-1',
        label: 'Promo1',
        configuredValue: '0.1900',
        actualAmount: '73872.0000',
      }),
    ] as never;
    return sale;
  };

  it('groups each item discount under "Diskon dan Promo" with an information affordance', () => {
    renderRuntimeDetail(twoLines());
    const groups = screen.getAllByRole('group', { name: 'Diskon dan Promo' });
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0]!.textContent).toContain('kilat (10%)');
    expect(groups[0]!.textContent).toContain('22.000');
    expect(
      within(groups[0]!).getByRole('button', { name: 'Rincian diskon dan promo' }),
    ).toBeTruthy();
  });

  it('shows the promotion facts from the Sale snapshot when the information button is opened', () => {
    renderRuntimeDetail(twoLines());
    const group = screen.getAllByRole('group', { name: 'Diskon dan Promo' })[0]!;
    fireEvent.click(within(group).getByRole('button', { name: 'Rincian diskon dan promo' }));
    expect(document.body.textContent).toContain('Diskon: 10%');
    expect(document.body.textContent).toContain('Per item');
    expect(document.body.textContent).toContain('Mulai: 1 Sep 2026');
    expect(document.body.textContent).toContain('Berakhir: 30 Sep 2026');
  });

  it('lists a Promotion applied to two lines once in the summary, summed, with the transaction promotion apart', () => {
    renderRuntimeDetail(twoLines());
    const summary = document.querySelector('.pos-financial-panel')!;
    const kilat = within(summary as HTMLElement).getAllByText(/kilat \(10%\)/);
    expect(kilat).toHaveLength(1);
    expect(summary.textContent).toContain('43.200');
    expect(summary.textContent).toContain('Promo1 (19%)');
    expect(summary.textContent).toContain('73.872');
  });

  const renderReceipt = (sale: Sale, hasTax = false) => {
    sale.status = 'FINALIZED';
    sale.finalizedAt = '2026-09-24T02:15:00.000Z';
    return render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={sale}
          activeLines={sale.lines}
          customer={sale.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount
          hasTax={hasTax}
        />
      </DeploymentBootstrapProvider>,
    );
  };

  it('receipt: names the promotion under each item without amounts, and sums it once in the summary', () => {
    renderReceipt(twoLines());
    expect(screen.getAllByText('Diskon dan Promo')).toHaveLength(3); // two items + summary
    expect(screen.getAllByText(/kilat \(10%\)/)).toHaveLength(3);
    expect(document.body.textContent).toContain('43.200');
    expect(document.body.textContent).not.toContain('22.000');
    expect(document.body.textContent).toContain('73.872');
  });

  it('receipt summary reads Subtotal, Pajak, Diskon dan Promo, Total in that order', () => {
    const sale = twoLines();
    sale.taxAmount = '34000.5600';
    renderReceipt(sale, true);
    const text = document.body.textContent ?? '';
    const subtotal = text.indexOf('Subtotal');
    const tax = text.indexOf('Pajak', subtotal);
    const discounts = text.indexOf('Diskon dan Promo', tax);
    const total = text.indexOf('TOTAL', discounts);
    expect(subtotal).toBeGreaterThan(-1);
    expect(tax).toBeGreaterThan(subtotal);
    expect(discounts).toBeGreaterThan(tax);
    expect(total).toBeGreaterThan(discounts);
  });

  it('receipt: exact cash shows no redundant tender row, over-tender shows tender and change', () => {
    const exact = twoLines();
    exact.payments[0]!.tenderedAmount = exact.payments[0]!.appliedAmount;
    exact.payments[0]!.changeAmount = '0.0000';
    const first = renderReceipt(exact);
    expect(screen.queryByText('Uang tunai diterima')).toBeNull();
    first.unmount();
    renderReceipt(twoLines()); // fixture: applied 197.580, tendered 200.000, change 2.420
    expect(screen.getByText('Uang tunai diterima')).toBeTruthy();
    expect(screen.getByText('Kembalian')).toBeTruthy();
  });
});

describe('ReferenceTransactionDetail WAITING Service continuation', () => {
  function waitingLine(overrides: Partial<SaleLine> = {}): SaleLine {
    const base = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' }).lines[0]!;
    return { ...base, ...overrides };
  }

  it('exposes a start action for a tracked Service still WAITING while the transaction is IN_PROGRESS', () => {
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    renderRuntimeDetail(sale);

    expect(screen.getByRole('button', { name: /Mulai pengerjaan/ })).toBeTruthy();
  });

  it('calls the fulfillment transition with only the clicked line when it is activated', () => {
    const onStartLineWork = vi.fn();
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    renderRuntimeDetail(sale, undefined, false, onStartLineWork);

    fireEvent.click(screen.getByRole('button', { name: /Mulai pengerjaan/ }));

    expect(onStartLineWork).toHaveBeenCalledTimes(1);
    expect((onStartLineWork.mock.calls[0]![0] as SaleLine).id).toBe('line-1');
  });

  it('lets two WAITING Service lines start independently, without affecting one another', () => {
    const onStartLineWork = vi.fn();
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    sale.lines.push(waitingLine({ id: 'line-2', itemNameSnapshot: 'Body Bleaching' }));
    renderRuntimeDetail(sale, undefined, false, onStartLineWork);

    const buttons = screen.getAllByRole('button', { name: /Mulai pengerjaan/ });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]!);

    expect(onStartLineWork).toHaveBeenCalledTimes(1);
    expect((onStartLineWork.mock.calls[0]![0] as SaleLine).id).toBe('line-2');
  });

  it('exposes the start action for a newly added tracked Service that is still WAITING', () => {
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    sale.lines[0]!.fulfillment = { ...sale.lines[0]!.fulfillment!, status: 'IN_PROGRESS' };
    sale.lines.push(waitingLine({ id: 'line-new', itemNameSnapshot: 'Body Bleaching' }));
    renderRuntimeDetail(sale);

    const buttons = screen.getAllByRole('button', { name: /Mulai pengerjaan/ });
    expect(buttons).toHaveLength(1);
  });

  it('does not offer a start action for a plain Product line', () => {
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    sale.lines[0] = {
      ...sale.lines[0]!,
      itemTypeSnapshot: 'PRODUCT',
      fulfillmentBehaviorSnapshot: 'INSTANT',
      fulfillment: null,
    } as SaleLine;
    renderRuntimeDetail(sale);

    expect(screen.queryByRole('button', { name: /Mulai pengerjaan/ })).toBeNull();
  });

  it('does not offer a start action once the Service is already IN_PROGRESS', () => {
    const sale = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    sale.lines[0]!.fulfillment = { ...sale.lines[0]!.fulfillment!, status: 'IN_PROGRESS' };
    renderRuntimeDetail(sale);

    expect(screen.queryByRole('button', { name: /Mulai pengerjaan/ })).toBeNull();
  });

  it('does not offer a start action for a COMPLETED or CANCELED Service', () => {
    const completed = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    completed.lines[0]!.fulfillment = { ...completed.lines[0]!.fulfillment!, status: 'COMPLETED' };
    const { unmount } = renderRuntimeDetail(completed);
    expect(screen.queryByRole('button', { name: /Mulai pengerjaan/ })).toBeNull();
    unmount();

    const canceled = runtimeQueueDetail({ operationalState: 'IN_PROGRESS' });
    canceled.lines[0]!.fulfillment = { ...canceled.lines[0]!.fulfillment!, status: 'CANCELED' };
    renderRuntimeDetail(canceled);
    expect(screen.queryByRole('button', { name: /Mulai pengerjaan/ })).toBeNull();
  });

  it('does not introduce the in-progress continuation action for a QUEUED transaction', () => {
    const sale = runtimeQueueDetail({ operationalState: 'QUEUED' });
    renderRuntimeDetail(sale);

    expect(screen.queryByRole('button', { name: /Mulai pengerjaan/ })).toBeNull();
  });
});

describe('ReferenceTransactionDetail invoice placement', () => {
  it('shows the invoice number once, in the customer identity block, on the right and above the date', () => {
    renderRuntimeDetail(runtimeQueueDetail());
    const invoice = screen.getAllByText('INV-20260924-000197');
    expect(invoice).toHaveLength(1);
    const node = screen.getByTestId('transaction-invoice-number');
    expect(node).toBe(invoice[0]);
    // Same block as the customer name and phone...
    const identity = node.closest('.px-1')!;
    expect(identity.textContent).toContain('Nida');
    expect(identity.textContent).toContain('+628123456789');
    // ...right-aligned, with the transaction date directly underneath it.
    const column = node.parentElement!;
    expect(column.className).toContain('items-end');
    expect(node.nextElementSibling?.textContent).toContain('24 Sep 2026');
    // Never in the global dialog header.
    const title = screen.getByText('Detail transaksi');
    expect(title.closest('header, [role="dialog"] > div')?.contains(node)).toBe(false);
    expect(title.parentElement?.textContent).not.toContain('INV-');
    expect(screen.getByText('TRX-20260924-000197')).toBeTruthy();
  });

  it('reserves nothing for an invoice that does not exist yet, and keeps the date on the right', () => {
    renderRuntimeDetail(runtimeQueueDetail({ invoiceNumber: null } as never));
    expect(screen.queryByTestId('transaction-invoice-number')).toBeNull();
    expect(screen.queryByText(/INV-/)).toBeNull();
    expect(screen.getByText(/24 Sep 2026/)).toBeTruthy();
  });
});

describe('ReferenceTransactionDetail Sale-level earned points', () => {
  const finalized = (overrides: Partial<Sale> = {}) =>
    runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
      loyaltyRedemption: null,
      ...overrides,
    });
  const renderReceipt = (sale: Sale) =>
    render(
      <DeploymentBootstrapProvider config={bootstrap}>
        <ReceiptContent
          sale={sale}
          activeLines={sale.lines}
          customer={sale.customer!}
          locale="id-ID"
          businessName="Digvation"
          branchName="Main branch"
          cashierName="Kasir"
          transactionDate="24 Sep 2026"
          hasDiscount={false}
          hasTax={false}
        />
      </DeploymentBootstrapProvider>,
    );

  it('detail shows the TRANSACTION_TOTAL total with no per-line earning', () => {
    renderRuntimeDetail(
      finalized({ loyaltyEarning: { state: 'FINALIZED', pointsEarned: '2.0000' } }),
    );

    const row = screen.getByTestId('transaction-points-earned');
    expect(within(row).getByText('Poin diperoleh')).toBeTruthy();
    expect(within(row).getByText('+2')).toBeTruthy();
    expect(screen.queryByText(/Poin diperoleh: \+/)).toBeNull();
  });

  it('detail keeps PER_ITEM line earning and adds the transaction total', () => {
    const sale = finalized({
      loyaltyEarning: { state: 'FINALIZED', pointsEarned: '34.0000' },
    });
    setLineLoyaltyEarning(sale, { state: 'FINALIZED', pointsEarned: '34.0000' });
    renderRuntimeDetail(sale);

    expect(screen.getByText('Poin diperoleh: +34 poin')).toBeTruthy();
    expect(within(screen.getByTestId('transaction-points-earned')).getByText('+34')).toBeTruthy();
  });

  it('detail shows no earned row (and no +0) when nothing was earned', () => {
    renderRuntimeDetail(finalized({ loyaltyEarning: null }));
    expect(screen.queryByTestId('transaction-points-earned')).toBeNull();
    cleanup();
    renderRuntimeDetail(
      finalized({ loyaltyEarning: { state: 'FINALIZED', pointsEarned: '0.0000' } }),
    );
    expect(screen.queryByTestId('transaction-points-earned')).toBeNull();
    expect(screen.queryByText('+0')).toBeNull();
  });

  it('detail preserves redemption while showing the earned total', () => {
    renderRuntimeDetail(
      finalized({
        loyaltyRedemption: {
          membershipId: 'membership-1',
          points: '1',
          pointValue: '1000.0000',
          amount: '1000.0000',
        },
        loyaltyEarning: { state: 'FINALIZED', pointsEarned: '1.0000' },
      }),
    );

    expect(screen.getByText('Penggunaan poin')).toBeTruthy();
    expect(screen.getByText(/1 poin digunakan/)).toBeTruthy();
    expect(within(screen.getByTestId('transaction-points-earned')).getByText('+1')).toBeTruthy();
  });

  it('detail does not show an OPEN Sale as earned', () => {
    renderRuntimeDetail(
      runtimeQueueDetail({
        loyaltyRedemption: null,
        loyaltyEarning: { state: 'FINALIZED', pointsEarned: '2.0000' },
      }),
    );
    expect(screen.queryByTestId('transaction-points-earned')).toBeNull();
  });

  it('receipt preview shows +2 once for a transaction-total earning with no line snapshots', () => {
    renderReceipt(finalized({ loyaltyEarning: { state: 'FINALIZED', pointsEarned: '2.0000' } }));

    const points = screen.getByTestId('receipt-points');
    expect(within(points).getByText('Diperoleh')).toBeTruthy();
    expect(within(points).getByText('+2')).toBeTruthy();
    expect(screen.getAllByText('+2')).toHaveLength(1);
  });

  it('receipt preview omits the row without an EARN fact, whatever the lines say', () => {
    const sale = finalized({ loyaltyEarning: null });
    setLineLoyaltyEarning(sale, { state: 'FINALIZED', pointsEarned: '6.0000' });
    renderReceipt(sale);

    expect(screen.queryByTestId('receipt-points')).toBeNull();
  });
});

describe('ReferenceTransactionDetail payments, refunds and payment attempts', () => {
  const refund = (id: string, method: 'CASH' | 'BANK_TRANSFER', account: string, amount: string) =>
    ({
      id,
      saleId: 'sale-runtime-1',
      method,
      status: 'SUCCEEDED',
      currency: 'IDR',
      appliedAmount: `-${amount}.0000`,
      tenderedAmount: null,
      changeAmount: null,
      providerReference: null,
      financeFinancialAccountNameSnapshot: account,
      idempotencyKey: `key-${id}`,
      createdByActorId: 'cashier-1',
      createdByActorKind: 'USER',
      settledByActorId: 'cashier-1',
      settledByActorKind: 'USER',
      terminalAt: '2026-10-08T13:41:00.000Z',
      createdAt: `2026-10-08T13:4${id.length}:00.000Z`,
      updatedAt: '2026-10-08T13:41:00.000Z',
      refund: {
        id: `refund-${id}`,
        kind: 'MANUAL',
        reason: 'ORDER_ADJUSTMENT',
        externalReference: null,
        note: null,
        adjustmentId: 'adjustment-1',
        allocations: [{ sourcePaymentId: 'bca-in', amount }],
      },
    }) as unknown as Sale['payments'][number];
  const incoming = (
    id: string,
    method: 'QRIS' | 'BANK_TRANSFER',
    account: string,
    amount: string,
  ) => ({
    ...runtimeQueueDetail().payments[0]!,
    id,
    method,
    financeFinancialAccountNameSnapshot: account,
    appliedAmount: `${amount}.0000`,
    tenderedAmount: null,
    changeAmount: null,
    createdAt: `2026-10-08T13:0${id.length}:00.000Z`,
  });

  /** Total 593.850; received 205.350 + 410.700; refunded 38.850 + 38.850 + 166.500. */
  const refundedSale = (extra: Sale['payments'] = []) =>
    runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-10-08T13:41:00.000Z',
      totalAmount: '593850.0000',
      grossAmount: '593850.0000',
      discountAmount: '0.0000',
      taxAmount: '0.0000',
      loyaltyRedemption: null,
      payments: [
        incoming('bca-in', 'BANK_TRANSFER', 'BCA', '205350'),
        incoming('qris-in', 'QRIS', 'QRIS BRI', '410700'),
        refund('r1', 'BANK_TRANSFER', 'BCA Operasional', '38850'),
        refund('r22', 'CASH', 'CASH', '38850'),
        refund('r333', 'BANK_TRANSFER', 'BCA Operasional', '166500'),
        ...extra,
      ],
    });
  const section = (name: string) =>
    screen.getByRole('heading', { name }).parentElement as HTMLElement;

  it('lists positive successful payments under "Pembayaran diterima"', () => {
    renderRuntimeDetail(refundedSale());
    const received = within(
      screen.getByRole('heading', { name: 'Pembayaran diterima' }).closest('.pos-payment-panel')!,
    );
    expect(received.getByText('QRIS BRI').closest('li')!.textContent).toMatch(/410[.,]700/);
    expect(received.getByText('BCA').closest('li')!.textContent).toMatch(/205[.,]350/);
    expect(received.queryByText('Pengembalian')).toBeNull();
  });

  it('lists each manual refund under "Pengembalian dana" on its actual disbursement account and method', () => {
    renderRuntimeDetail(refundedSale());
    const list = section('Pengembalian dana').querySelector('ul')!;
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toContain('BCA Operasional');
    expect(rows[0]!.textContent).toContain('Transfer bank · Pengembalian');
    expect(rows[0]!.textContent).toMatch(/38[.,]850/);
    expect(rows[1]!.textContent).toContain('Tunai · Pengembalian');
    expect(rows[2]!.textContent).toMatch(/166[.,]500/);
    // The original QRIS attribution is never presented as a QRIS refund.
    expect(list.textContent).not.toContain('QRIS');
  });

  it('never presents a successful refund as a payment attempt', () => {
    renderRuntimeDetail(refundedSale());
    expect(screen.queryByRole('heading', { name: 'Percobaan pembayaran' })).toBeNull();
  });

  it('still lists pending and failed payments under payment attempts, apart from refunds', () => {
    const pending = {
      ...incoming('pending-in', 'BANK_TRANSFER', 'Mandiri', '50000'),
      status: 'PENDING',
    } as Sale['payments'][number];
    const failed = {
      ...incoming('failed-in', 'QRIS', 'QRIS BCA', '30000'),
      status: 'FAILED',
    } as Sale['payments'][number];
    renderRuntimeDetail(refundedSale([pending, failed]));
    const attempts = section('Percobaan pembayaran');
    expect(attempts.textContent).toContain('Mandiri');
    expect(attempts.textContent).toContain('QRIS BCA');
    expect(attempts.textContent).not.toContain('Pengembalian');
    expect(attempts.textContent).not.toContain('BCA Operasional');
    expect(section('Pengembalian dana').textContent).not.toContain('Mandiri');
  });

  it('labels the paid amount as net of refunds: 616.050 received − 244.200 refunded = 371.850', () => {
    renderRuntimeDetail(refundedSale());
    const net = screen.getByText('Dibayar bersih');
    expect(net.nextElementSibling!.textContent).toMatch(/371[.,]850/);
    expect(screen.queryByText('Dibayar')).toBeNull();
    expect(screen.getByText('Sisa tagihan').nextElementSibling!.textContent).toMatch(/222[.,]000/);
  });

  it('keeps the plain "Dibayar" label when nothing was refunded', () => {
    renderRuntimeDetail(runtimeQueueDetail());
    expect(screen.queryByText('Dibayar bersih')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pengembalian dana' })).toBeNull();
  });

  it('identifies each refund in words, not only by a minus sign, on every viewport', () => {
    renderRuntimeDetail(refundedSale());
    const rows = within(section('Pengembalian dana').querySelector('ul')!).getAllByRole('listitem');
    for (const row of rows) {
      // The same markup serves compact and wide layouts: the word never depends on a breakpoint.
      expect(row.textContent).toContain('Pengembalian');
      expect(row.textContent).not.toMatch(/[-−]\s*Rp/);
      expect(row.querySelector('[class*="hidden"], [class*="sm:hidden"]')).toBeNull();
    }
  });
});
