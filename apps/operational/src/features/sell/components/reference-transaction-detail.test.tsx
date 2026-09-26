import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Employee, Sale, SaleLine } from '../cashier-transaction.types';
import { presentableTransaction } from '../completed-sale-visibility';
import {
  ReceiptContent,
  ReferenceTransactionDetail,
} from './replatformed-pos-workspace';

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
  delivery?: { status: 'FAILED'; onRetry: () => void },
  showPaymentReceipt = false,
) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <ReferenceTransactionDetail
        sale={sale}
        locale="id-ID"
        employees={[]}
        businessName="Digvation"
        branchName="Main branch"
        cashierName="Kasir"
        showPaymentReceipt={showPaymentReceipt}
        onClose={vi.fn()}
        onNewSale={vi.fn()}
        onViewReceipt={vi.fn()}
        onAssign={vi.fn()}
        onComplete={vi.fn()}
        isMutating={false}
        {...(delivery
          ? {
              deliveryStatus: {
                available: true,
                delivery: {
                  status: delivery.status,
                  attemptCount: 3,
                  retryAllowed: true,
                },
              },
              onRetryDelivery: delivery.onRetry,
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

  it('makes a failed receipt delivery visible and retryable without changing the Sale', () => {
    const onRetry = vi.fn();
    const sale = runtimeQueueDetail({
      status: 'FINALIZED',
      finalizedAt: '2026-09-24T02:15:00.000Z',
    });

    renderRuntimeDetail(sale, { status: 'FAILED', onRetry }, true);

    const retry = screen.queryByRole('button', { name: /retry sending/i });
    expect(retry).not.toBeNull();
    retry?.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
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
          participations: [participation('line-color', 'emp-andini'), participation('line-color', 'emp-rindu')],
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
          participations: [participation('line-shared', 'emp-andini'), participation('line-shared', 'emp-rindu')],
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
