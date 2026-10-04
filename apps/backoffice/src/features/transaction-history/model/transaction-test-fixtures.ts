import type {
  Payment,
  PaymentStatus,
  Sale,
  SaleAdjustment,
  SaleLine,
  SaleLineCompositionComponent,
} from '../api/transaction-history-api';

export const EMPLOYEE = {
  rina: '00000000-0000-4000-8000-0000000000e1',
  citra: '00000000-0000-4000-8000-0000000000e2',
  budi: '00000000-0000-4000-8000-0000000000e3',
  dewi: '00000000-0000-4000-8000-0000000000e4',
} as const;

export const WORK_EMPLOYEES = [
  { id: EMPLOYEE.rina, code: 'EMP-001', displayName: 'Rina Kartika' },
  { id: EMPLOYEE.citra, code: 'EMP-002', displayName: 'Citra Ayu' },
  { id: EMPLOYEE.budi, code: 'EMP-003', displayName: 'Budi Santoso' },
];

export function testPayment(
  id: string,
  status: PaymentStatus,
  appliedAmount: string,
  change: Partial<Payment> = {},
): Payment {
  return {
    id,
    method: 'CASH',
    status,
    currency: 'IDR',
    appliedAmount,
    tenderedAmount: null,
    changeAmount: null,
    providerReference: null,
    refundOfPaymentId: null,
    financeFinancialAccountNameSnapshot: null,
    terminalAt: null,
    createdAt: `2026-10-01T03:00:0${id.length % 10}.000Z`,
    ...change,
  };
}

export function testAdjustment(change: Partial<SaleAdjustment> = {}): SaleAdjustment {
  return {
    id: 'adjustment-1',
    source: 'PROMOTION',
    scope: 'ITEM',
    type: 'FIXED_AMOUNT',
    configuredValue: '40000.0000',
    requestedValue: null,
    actualAmount: '40000.0000',
    label: 'Promo Member Oktober',
    saleLineId: 'line-service',
    reason: null,
    createdAt: '2026-10-01T03:00:01.000Z',
    ...change,
  };
}

export function testComponent(
  change: Partial<SaleLineCompositionComponent> = {},
): SaleLineCompositionComponent {
  return {
    id: 'component-1',
    position: 0,
    componentSource: 'SALE_SELECTED',
    itemNameSnapshot: 'Hair Color Red',
    variantNameSnapshot: null,
    quantity: '1.0000',
    pricingMode: 'FOLLOW_PRODUCT_PRICE',
    extendedContribution: '50000.0000',
    performers: [{ employeeId: EMPLOYEE.citra, shareRate: '1' }],
    contributions: [],
    ...change,
  };
}

export function testLine(change: Partial<SaleLine> = {}): SaleLine {
  return {
    id: 'line-service',
    itemTypeSnapshot: 'SERVICE',
    itemNameSnapshot: 'Hair Coloring',
    variantNameSnapshot: 'Long Hair',
    quantity: '1.0000',
    effectiveUnitPrice: '250000.0000',
    grossAmount: '250000.0000',
    lineDiscountAmount: '0.0000',
    totalAmount: '250000.0000',
    netPreTaxAmount: '250000.0000',
    soldByEmployeeId: null,
    soldByEmployeeCodeSnapshot: null,
    soldByEmployeeNameSnapshot: null,
    fulfillmentBehaviorSnapshot: 'TRACKED',
    removedAt: null,
    correctedFromLineId: null,
    fulfillment: {
      status: 'WAITING',
      startedAt: null,
      completedAt: null,
      canceledAt: null,
    },
    participations: [{ employeeId: EMPLOYEE.rina, assigned: true, shareRate: null }],
    workUnits: [{ unitNumber: 1, employeeIds: [EMPLOYEE.rina] }],
    contributions: [],
    compositionComponents: [],
    ...change,
  };
}

export function testProductLine(change: Partial<SaleLine> = {}): SaleLine {
  return testLine({
    id: 'line-product',
    itemTypeSnapshot: 'PRODUCT',
    itemNameSnapshot: 'Shampoo Keratin',
    variantNameSnapshot: '250 ml',
    quantity: '2.0000',
    effectiveUnitPrice: '45000.0000',
    grossAmount: '90000.0000',
    totalAmount: '90000.0000',
    fulfillmentBehaviorSnapshot: 'INSTANT',
    fulfillment: null,
    participations: [],
    workUnits: [],
    soldByEmployeeId: EMPLOYEE.dewi,
    soldByEmployeeCodeSnapshot: 'EMP-004',
    soldByEmployeeNameSnapshot: 'Dewi Lestari',
    ...change,
  });
}

export function testSale(change: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    saleNumber: 'TRX-20261001-000001',
    invoiceNumber: null,
    sellingLocationId: 'location-1',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'UNSUBMITTED',
    version: 3,
    grossAmount: '250000.0000',
    totalAmount: '250000.0000',
    taxAmount: '0.0000',
    discountAmount: '0.0000',
    createdAt: '2026-10-01T03:00:00.000Z',
    finalizedAt: null,
    voidedAt: null,
    customer: null,
    reversal: null,
    loyaltyRedemption: null,
    lines: [testLine()],
    payments: [],
    workEmployees: WORK_EMPLOYEES,
    ...change,
  };
}

const completed = (line: SaleLine, employeeId: string, name: string): SaleLine => ({
  ...line,
  fulfillment: {
    status: 'COMPLETED',
    startedAt: '2026-10-01T04:00:00.000Z',
    completedAt: '2026-10-01T05:00:00.000Z',
    canceledAt: null,
  },
  contributions: [{ employeeId, employeeCodeSnapshot: 'EMP-X', employeeDisplayNameSnapshot: name }],
});

/** The representative transactions of the manual/visual review (A–H). */
export const SCENARIOS = {
  /** A. OPEN, no payment, draft work. */
  draft: testSale({ id: 'sale-a', saleNumber: 'TRX-20261001-000001' }),
  /** B. OPEN, pending payment, queued work. */
  queued: testSale({
    id: 'sale-b',
    saleNumber: 'TRX-20261001-000002',
    operationalState: 'QUEUED',
    payments: [testPayment('qris-b', 'PENDING', '250000.0000', { method: 'QRIS' })],
  }),
  /** C. OPEN, partial split payment, service work in progress. */
  inProgress: testSale({
    id: 'sale-c',
    saleNumber: 'TRX-20261001-000003',
    operationalState: 'IN_PROGRESS',
    totalAmount: '500000.0000',
    grossAmount: '500000.0000',
    lines: [
      testLine({
        quantity: '2.0000',
        grossAmount: '500000.0000',
        fulfillment: {
          status: 'IN_PROGRESS',
          startedAt: '2026-10-01T04:00:00.000Z',
          completedAt: null,
          canceledAt: null,
        },
        participations: [
          { employeeId: EMPLOYEE.rina, assigned: true, shareRate: null },
          { employeeId: EMPLOYEE.budi, assigned: true, shareRate: null },
        ],
        workUnits: [
          { unitNumber: 1, employeeIds: [EMPLOYEE.rina] },
          { unitNumber: 2, employeeIds: [EMPLOYEE.budi] },
        ],
      }),
    ],
    payments: [
      testPayment('bca-c', 'SUCCEEDED', '200000.0000', {
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA',
        providerReference: 'TRF-88213',
      }),
      testPayment('failed-c', 'FAILED', '300000.0000', { method: 'QRIS' }),
    ],
  }),
  /** D. FINALIZED, one payment, completed work. */
  paid: testSale({
    id: 'sale-d',
    saleNumber: 'TRX-20261001-000004',
    invoiceNumber: 'INV-20261001-000004',
    status: 'FINALIZED',
    operationalState: 'IN_PROGRESS',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    customer: { type: 'MEMBER', name: 'Nida Rahmawati' },
    lines: [completed(testLine(), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [
      testPayment('cash-d', 'SUCCEEDED', '250000.0000', {
        tenderedAmount: '300000.0000',
        changeAmount: '50000.0000',
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
    ],
  }),
  /** E. FINALIZED, split payment, multiple completed Service lines. */
  split: testSale({
    id: 'sale-e',
    saleNumber: 'TRX-20261001-000005',
    invoiceNumber: 'INV-20261001-000005',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    totalAmount: '400000.0000',
    grossAmount: '400000.0000',
    lines: [
      completed(testLine(), EMPLOYEE.rina, 'Rina Kartika'),
      completed(
        testLine({
          id: 'line-service-2',
          itemNameSnapshot: 'Creambath Ginseng',
          variantNameSnapshot: null,
          grossAmount: '150000.0000',
          effectiveUnitPrice: '150000.0000',
        }),
        EMPLOYEE.budi,
        'Budi Santoso',
      ),
    ],
    payments: [
      testPayment('bca-e', 'SUCCEEDED', '250000.0000', {
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA',
      }),
      testPayment('cash-e', 'SUCCEEDED', '150000.0000', {
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
    ],
  }),
  /** F. FINALIZED, refunded in full, then reversed; the work had been completed. */
  reversed: testSale({
    id: 'sale-f',
    saleNumber: 'TRX-20261001-000006',
    invoiceNumber: 'INV-20261001-000006',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    reversal: { reason: 'Customer complaint', reversedAt: '2026-10-01T08:00:00.000Z' },
    lines: [completed(testLine(), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [
      testPayment('cash-f', 'SUCCEEDED', '250000.0000', {
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
      testPayment('refund-f', 'SUCCEEDED', '-250000.0000', {
        providerReference: 'REFUND:cash-f',
        refundOfPaymentId: 'cash-f',
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
    ],
  }),
  /** G. Product-only Sale. */
  productOnly: testSale({
    id: 'sale-g',
    saleNumber: 'TRX-20261001-000007',
    invoiceNumber: 'INV-20261001-000007',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    totalAmount: '90000.0000',
    grossAmount: '90000.0000',
    lines: [testProductLine()],
    payments: [testPayment('cash-g', 'SUCCEEDED', '90000.0000')],
  }),
  /** H. Service with a sale-selected additional product worked by a different employee. */
  withComponent: testSale({
    id: 'sale-h',
    saleNumber: 'TRX-20261001-000008',
    operationalState: 'QUEUED',
    totalAmount: '300000.0000',
    grossAmount: '300000.0000',
    lines: [testLine({ compositionComponents: [testComponent()] })],
  }),
  /** I. FINALIZED with an item Promotion and a transaction-level manual discount. */
  promotion: testSale({
    id: 'sale-i',
    saleNumber: 'TRX-20261001-000009',
    invoiceNumber: 'INV-20261001-000009',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    grossAmount: '340000.0000',
    discountAmount: '74000.0000',
    totalAmount: '266000.0000',
    promotionCode: 'OKTOBER25',
    lines: [
      completed(
        testLine({
          lineDiscountAmount: '40000.0000',
          orderDiscountAllocationAmount: '0.0000',
          discountedCustomerBaseAmount: '210000.0000',
        }),
        EMPLOYEE.rina,
        'Rina Kartika',
      ),
      testProductLine({ orderDiscountAllocationAmount: '34000.0000' }),
    ],
    adjustments: [
      testAdjustment({
        label: 'Promo Member Oktober — Diskon Pewarnaan Rambut Spesial Akhir Bulan',
      }),
      testAdjustment({
        id: 'manual-i',
        source: 'MANUAL_DISCOUNT',
        scope: 'TRANSACTION',
        type: 'PERCENTAGE',
        configuredValue: '10.0000',
        label: 'Diskon manual',
        saleLineId: null,
        actualAmount: '34000.0000',
        reason: 'Pelanggan lama',
        createdAt: '2026-10-01T03:00:02.000Z',
      }),
    ],
    payments: [testPayment('cash-i', 'SUCCEEDED', '266000.0000')],
  }),
  /** J. Member who earned points without redeeming. */
  memberEarning: testSale({
    id: 'sale-j',
    saleNumber: 'TRX-20261001-000010',
    invoiceNumber: 'INV-20261001-000010',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    customer: { type: 'MEMBER', name: 'Andini Puspitasari Wulandari Kusumaningrum' },
    loyaltyEarning: { state: 'FINALIZED', pointsEarned: '71.0000' },
    loyaltySummary: {
      earnedPoints: '71.0000',
      redeemedPoints: '0.0000',
      balanceAfter: '1240.0000',
    },
    lines: [completed(testLine(), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [testPayment('cash-j', 'SUCCEEDED', '250000.0000')],
  }),
  /** K. Member who redeemed and earned points. */
  memberRedeeming: testSale({
    id: 'sale-k',
    saleNumber: 'TRX-20261001-000011',
    invoiceNumber: 'INV-20261001-000011',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    customer: { type: 'MEMBER', name: 'Andini Puspitasari' },
    totalAmount: '200000.0000',
    loyaltyRedemption: {
      membershipId: 'membership-1',
      points: '500.0000',
      pointValue: '100.0000',
      amount: '50000.0000',
    },
    loyaltyEarning: { state: 'FINALIZED', pointsEarned: '20.0000' },
    loyaltySummary: {
      earnedPoints: '20.0000',
      redeemedPoints: '500.0000',
      balanceAfter: '760.0000',
    },
    lines: [completed(testLine(), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [testPayment('cash-k', 'SUCCEEDED', '200000.0000')],
  }),
  /** L. Split payment with the cash part refunded; the bank part needs its provider. */
  partiallyRefunded: testSale({
    id: 'sale-l',
    saleNumber: 'TRX-20260930-000175',
    invoiceNumber: 'INV-20260930-000175',
    status: 'FINALIZED',
    finalizedAt: '2026-09-30T12:00:00.000Z',
    totalAmount: '710289.0000',
    grossAmount: '710289.0000',
    lines: [completed(testLine({ grossAmount: '710289.0000' }), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [
      testPayment('bca-l', 'SUCCEEDED', '174825.0000', {
        method: 'BANK_TRANSFER',
        financeFinancialAccountNameSnapshot: 'BCA',
      }),
      testPayment('cash-l', 'SUCCEEDED', '535464.0000', {
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
      testPayment('refund-l', 'SUCCEEDED', '-535464.0000', {
        refundOfPaymentId: 'cash-l',
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
    ],
  }),
  /** M. Fully refunded, ready for reversal. */
  readyToReverse: testSale({
    id: 'sale-m',
    saleNumber: 'TRX-20261001-000012',
    invoiceNumber: 'INV-20261001-000012',
    status: 'FINALIZED',
    finalizedAt: '2026-10-01T06:00:00.000Z',
    lines: [completed(testLine(), EMPLOYEE.rina, 'Rina Kartika')],
    payments: [
      testPayment('cash-m', 'SUCCEEDED', '250000.0000', {
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
      testPayment('refund-m', 'SUCCEEDED', '-250000.0000', {
        refundOfPaymentId: 'cash-m',
        financeFinancialAccountNameSnapshot: 'CASH',
      }),
    ],
  }),
} satisfies Record<string, Sale>;
