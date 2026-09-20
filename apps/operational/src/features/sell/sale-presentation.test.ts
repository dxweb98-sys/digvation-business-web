import { describe, expect, it } from 'vitest';

import type { EmployeeContribution, SaleAdjustment } from './cashier-transaction.types';
import {
  appliedPaymentComposition,
  checkoutAdjustmentRows,
  discountPresentation,
  lineDiscountPresentation,
  employeeDisplayName,
  lineBaseSubtotal,
  lineDiscountPercentage,
  paymentIntent,
  paymentProgress,
  percentageFromRate,
  saleDiscountRows,
  saleSettlement,
  saleTaxLabel,
  saleTaxPercentage,
  saleTaxTreatment,
  transactionDiscountLabel,
  transactionDiscountPercentage,
} from './sale-presentation';

const percentageAdjustment = {
  id: 'adjustment-1',
  source: 'PROMOTION',
  scope: 'TRANSACTION',
  type: 'PERCENTAGE',
  configuredValue: '0.1',
  requestedValue: null,
  actualAmount: '15000.0000',
  promotionId: 'promotion-1',
  label: 'Promo September',
  saleLineId: null,
  actorId: null,
  actorKind: null,
  reason: null,
  createdAt: '2026-09-17T00:00:00.000Z',
} satisfies SaleAdjustment;

const emptyOrderDiscount = {
  orderDiscountType: null,
  orderDiscountValue: null,
  orderDiscountAmount: '0.0000',
  orderDiscountReason: null,
} as const;

describe('sale presentation', () => {
  it('keeps the authoritative base line subtotal separate from the net line total', () => {
    expect(lineBaseSubtotal({ grossAmount: '150000.0000' })).toBe('150000.0000');
    expect(lineDiscountPercentage({ discountType: 'PERCENTAGE', discountValue: '0.1' })).toBe('10');
    expect(
      lineDiscountPercentage({ discountType: 'FIXED_AMOUNT', discountValue: '15000.0000' }),
    ).toBeNull();
  });

  it('keeps automatic item promotions on the item rather than duplicating them in checkout', () => {
    const itemPromotion = {
      ...percentageAdjustment,
      scope: 'ITEM' as const,
      saleLineId: 'line-1',
    } satisfies SaleAdjustment;
    expect(checkoutAdjustmentRows({ adjustments: [itemPromotion], promotionCode: null })).toEqual(
      [],
    );
    expect(
      checkoutAdjustmentRows({ adjustments: [itemPromotion], promotionCode: 'WELCOME10' }),
    ).toEqual([itemPromotion]);
  });
  it('uses configured percentage metadata instead of deriving percentage from money amounts', () => {
    expect(percentageFromRate('0.1')).toBe('10');
    expect(
      transactionDiscountPercentage({
        adjustments: [percentageAdjustment],
        ...emptyOrderDiscount,
      }),
    ).toBe('10');
    expect(
      transactionDiscountLabel(
        { adjustments: [percentageAdjustment], ...emptyOrderDiscount },
        'Promo dan diskon',
      ),
    ).toBe('Promo dan diskon (10%)');
  });

  it('does not fabricate one percentage when several discount adjustments apply', () => {
    const nominalAdjustment = {
      ...percentageAdjustment,
      id: 'adjustment-2',
      source: 'MANUAL_DISCOUNT',
      type: 'FIXED_AMOUNT',
      configuredValue: '5000.0000',
      actualAmount: '5000.0000',
      promotionId: null,
      label: 'Diskon manual',
    } satisfies SaleAdjustment;
    const sale = {
      adjustments: [percentageAdjustment, nominalAdjustment],
      ...emptyOrderDiscount,
    };

    expect(transactionDiscountPercentage(sale)).toBeNull();
    expect(transactionDiscountLabel(sale, 'Promo dan diskon')).toBe('Promo dan diskon');
    expect(saleDiscountRows(sale)).toEqual([
      expect.objectContaining({ label: 'Promo September', percentage: '10' }),
      expect.objectContaining({ label: 'Diskon manual', percentage: null }),
    ]);
  });

  it('shows one authoritative tax percentage even when equivalent rates use different precision', () => {
    const sale = {
      transactionTaxAmount: '5000.0000',
      transactionTaxRate: '0.11',
      transactionTaxTreatment: 'EXCLUDED' as const,
      lines: [
        {
          removedAt: null,
          itemTaxAmount: '8378.0000',
          itemTaxRate: '0.1100',
          itemTaxTreatment: 'EXCLUDED' as const,
        },
      ],
    };

    expect(saleTaxPercentage(sale)).toBe('11');
    expect(saleTaxTreatment(sale)).toBe('EXCLUDED');
    expect(saleTaxLabel(sale, 'Pajak')).toBe('Pajak (11%)');
  });

  it('does not fabricate one tax percentage for mixed rates', () => {
    const sale = {
      transactionTaxAmount: '5000.0000',
      transactionTaxRate: '0.11',
      transactionTaxTreatment: 'EXCLUDED' as const,
      lines: [
        {
          removedAt: null,
          itemTaxAmount: '7500.0000',
          itemTaxRate: '0.1',
          itemTaxTreatment: 'EXCLUDED' as const,
        },
      ],
    };

    expect(saleTaxPercentage(sale)).toBeNull();
    expect(saleTaxLabel(sale, 'Pajak')).toBe('Pajak');
  });

  it('preserves inclusive tax treatment in the label without changing the amount', () => {
    const sale = {
      transactionTaxAmount: '13378.0000',
      transactionTaxRate: '0.11',
      transactionTaxTreatment: 'INCLUDED' as const,
      lines: [],
    };

    expect(saleTaxTreatment(sale)).toBe('INCLUDED');
    expect(saleTaxLabel(sale, 'Pajak')).toBe('Pajak termasuk (11%)');
    expect(saleTaxLabel(sale, 'Tax')).toBe('Tax included (11%)');
  });

  it('resolves performer display name from immutable snapshot, canonical employees, then fallback', () => {
    const contribution = {
      saleId: 'sale-1',
      saleLineId: 'line-1',
      employeeId: 'employee-1',
      employeeCodeSnapshot: 'EMP-001',
      employeeDisplayNameSnapshot: 'Rindu Putri',
      shareRate: '1.0000',
      contributionBaseAmount: '150000.0000',
      contributionAmount: '150000.0000',
      finalizedAt: '2026-09-17T00:00:00.000Z',
    } satisfies EmployeeContribution;

    expect(
      employeeDisplayName({ contributions: [contribution] }, 'employee-1', [
        { id: 'employee-1', displayName: 'Nama Baru' },
      ]),
    ).toBe('Rindu Putri');
    expect(
      employeeDisplayName({ contributions: [] }, 'employee-1', [
        { id: 'employee-1', displayName: 'Rindu Putri' },
      ]),
    ).toBe('Rindu Putri');
    expect(
      employeeDisplayName({ contributions: [] }, 'missing-id', [], 'Karyawan tidak tersedia'),
    ).toBe('Karyawan tidak tersedia');
  });
});

describe('saleSettlement', () => {
  const payment = (
    status: 'SUCCEEDED' | 'PENDING' | 'FAILED',
    appliedAmount: string,
    method: 'CASH' | 'QRIS' = 'CASH',
    tenderedAmount: string | null = null,
    changeAmount: string | null = null,
  ) => ({ status, method, appliedAmount, tenderedAmount, changeAmount });

  it('reports an unpaid sale with the full authoritative total as balance', () => {
    expect(saleSettlement({ totalAmount: '184815.0000', payments: [] })).toEqual({
      totalPaid: '0.0000',
      balanceDue: '184815.0000',
      cashTendered: null,
      cashChange: null,
      paymentState: 'UNPAID',
    });
  });

  it('sums only succeeded payments and exposes cash tendered and change', () => {
    expect(
      saleSettlement({
        totalAmount: '150000.0000',
        payments: [
          payment('SUCCEEDED', '150000.0000', 'CASH', '200000.0000', '50000.0000'),
          payment('FAILED', '150000.0000'),
        ],
      }),
    ).toEqual({
      totalPaid: '150000.0000',
      balanceDue: '0.0000',
      cashTendered: '200000.0000',
      cashChange: '50000.0000',
      paymentState: 'PAID',
    });
  });

  it('reconciles an exact two-way split and keeps cash tender separate from applied amount', () => {
    expect(
      saleSettlement({
        totalAmount: '500000.0000',
        payments: [
          payment('SUCCEEDED', '300000.0000', 'QRIS'),
          payment('SUCCEEDED', '200000.0000', 'CASH', '250000.0000', '50000.0000'),
        ],
      }),
    ).toEqual({
      totalPaid: '500000.0000',
      balanceDue: '0.0000',
      cashTendered: '250000.0000',
      cashChange: '50000.0000',
      paymentState: 'PAID',
    });
  });

  it('keeps a sale partially paid while a payment is pending or the total is not covered', () => {
    expect(
      saleSettlement({
        totalAmount: '150000.0000',
        payments: [payment('SUCCEEDED', '50000.0000', 'QRIS')],
      }),
    ).toMatchObject({ balanceDue: '100000.0000', paymentState: 'PARTIALLY_PAID' });
    expect(
      saleSettlement({
        totalAmount: '150000.0000',
        payments: [payment('SUCCEEDED', '150000.0000', 'QRIS'), payment('PENDING', '1.0000')],
      }).paymentState,
    ).toBe('PARTIALLY_PAID');
  });
});

describe('discount presentation', () => {
  const manual = (percentage: string | null, reason: string | null) => ({
    source: 'MANUAL_DISCOUNT' as const,
    label: reason ?? '',
    percentage,
    reason,
  });

  it('titles a manual discount by what it is and keeps the reason secondary', () => {
    expect(discountPresentation(manual('10', 'diskon apaan'), 'Diskon')).toEqual({
      title: 'Diskon (10%)',
      note: 'diskon apaan',
    });
    expect(discountPresentation(manual(null, 'diskon apaan'), 'Diskon')).toEqual({
      title: 'Diskon',
      note: 'diskon apaan',
    });
  });

  it('omits the note when no reason was recorded', () => {
    expect(discountPresentation(manual('10', '  '), 'Diskon')).toEqual({
      title: 'Diskon (10%)',
      note: null,
    });
  });

  it('keeps the promotion name', () => {
    expect(
      discountPresentation(
        { source: 'PROMOTION', label: 'Promo Hari Ibu', percentage: '15', reason: null },
        'Diskon',
      ),
    ).toEqual({ title: 'Promo Hari Ibu (15%)', note: null });
  });

  it('presents a line discount the same way', () => {
    expect(
      lineDiscountPresentation(
        { discountType: 'PERCENTAGE', discountValue: '0.1', discountReason: 'langganan' },
        'Diskon',
      ),
    ).toEqual({ title: 'Diskon (10%)', note: 'langganan' });
  });
});

describe('payment progress and intent', () => {
  const payment = (
    status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'CANCELLED',
    appliedAmount: string,
  ) => ({
    status,
    appliedAmount,
  });

  it('treats one method for the whole total as a full payment', () => {
    expect(paymentIntent({ totalAmount: '500000', payments: [] }, '500000')).toMatchObject({
      remainingAmount: '500000.0000',
      remainingAfter: '0.0000',
      outcome: 'COMPLETES',
      isSplit: false,
    });
  });

  it('marks a partial first payment as a split that leaves a balance', () => {
    expect(paymentIntent({ totalAmount: '500000', payments: [] }, '300000')).toMatchObject({
      remainingAfter: '200000.0000',
      outcome: 'LEAVES_BALANCE',
      isSplit: true,
    });
  });

  it('recalculates what remains when the amount is corrected before confirming', () => {
    const sale = { totalAmount: '500000', payments: [] };
    expect(paymentIntent(sale, '300000').remainingAfter).toBe('200000.0000');
    expect(paymentIntent(sale, '250000').remainingAfter).toBe('250000.0000');
  });

  it('completes the sale when the next cash payment covers the remaining balance', () => {
    const sale = { totalAmount: '500000', payments: [payment('SUCCEEDED', '300000')] };
    expect(paymentIntent(sale, '200000')).toMatchObject({
      paidAmount: '300000.0000',
      remainingAmount: '200000.0000',
      outcome: 'COMPLETES',
      isSplit: true,
    });
  });

  it('never counts failed or cancelled attempts and reserves pending ones', () => {
    expect(
      paymentProgress({
        totalAmount: '500000',
        payments: [
          payment('SUCCEEDED', '300000'),
          payment('FAILED', '150000'),
          payment('CANCELLED', '200000'),
          payment('PENDING', '50000'),
        ],
      }),
    ).toEqual({
      paidAmount: '300000.0000',
      pendingAmount: '50000.0000',
      remainingAmount: '150000.0000',
    });
  });
});

describe('appliedPaymentComposition', () => {
  const payment = (
    id: string,
    status: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'EXPIRED',
    appliedAmount: string,
  ) => ({ id, status, appliedAmount });

  it('treats one successful payment as a single payment', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [payment('cash', 'SUCCEEDED', '500000.0000')],
    });
    expect(result).toMatchObject({ isSplit: false, settled: true, totalPaid: '500000.0000' });
    expect(result.components.map((item) => item.id)).toEqual(['cash']);
  });

  it('classifies two payments that settle the sale together as a split payment', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'SUCCEEDED', '300000.0000'),
        payment('cash', 'SUCCEEDED', '200000.0000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: true, totalPaid: '500000.0000' });
    expect(result.components.map((item) => item.id)).toEqual(['bca', 'cash']);
  });

  it('never counts a failed attempt, so a failed transfer plus cash is not a split', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'FAILED', '500000.0000'),
        payment('cash', 'SUCCEEDED', '500000.0000'),
      ],
    });
    expect(result.isSplit).toBe(false);
    expect(result.components.map((item) => item.id)).toEqual(['cash']);
  });

  it('never counts a cancelled or expired attempt toward settlement', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'CANCELLED', '300000.0000'),
        payment('qris', 'EXPIRED', '200000.0000'),
        payment('cash', 'SUCCEEDED', '500000.0000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: false, totalPaid: '500000.0000' });
  });

  it('lists every component of a three-way split', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'SUCCEEDED', '200000.0000'),
        payment('cash', 'SUCCEEDED', '150000.0000'),
        payment('wallet', 'SUCCEEDED', '150000.0000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: true, totalPaid: '500000.0000' });
    expect(result.components).toHaveLength(3);
  });

  it('does not call a partly paid sale a split payment yet', () => {
    const result = appliedPaymentComposition({
      totalAmount: '500000.0000',
      payments: [
        payment('bca', 'SUCCEEDED', '100000.0000'),
        payment('cash', 'SUCCEEDED', '100000.0000'),
      ],
    });
    expect(result).toMatchObject({ isSplit: false, settled: false, totalPaid: '200000.0000' });
  });
});

describe('appliedPaymentComposition order', () => {
  it('lists split components in the order they were taken', () => {
    const result = appliedPaymentComposition({
      totalAmount: '300000.0000',
      payments: [
        {
          id: 'cash',
          status: 'SUCCEEDED',
          appliedAmount: '100000',
          createdAt: '2026-09-19T08:03:00.000Z',
        },
        {
          id: 'bca',
          status: 'SUCCEEDED',
          appliedAmount: '200000',
          createdAt: '2026-09-19T08:01:00.000Z',
        },
      ],
    });
    expect(result.components.map((item) => item.id)).toEqual(['bca', 'cash']);
  });
});
