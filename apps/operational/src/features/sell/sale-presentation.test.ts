import { describe, expect, it } from 'vitest';

import type { EmployeeContribution, SaleAdjustment } from './cashier-transaction.types';
import {
  employeeDisplayName,
  lineBaseSubtotal,
  lineDiscountPercentage,
  percentageFromRate,
  saleDiscountRows,
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
    expect(lineDiscountPercentage({ discountType: 'PERCENTAGE', discountValue: '0.1' })).toBe(
      '10',
    );
    expect(
      lineDiscountPercentage({ discountType: 'FIXED_AMOUNT', discountValue: '15000.0000' }),
    ).toBeNull();
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
      employeeDisplayName(
        { contributions: [contribution] },
        'employee-1',
        [{ id: 'employee-1', displayName: 'Nama Baru' }],
      ),
    ).toBe('Rindu Putri');
    expect(
      employeeDisplayName(
        { contributions: [] },
        'employee-1',
        [{ id: 'employee-1', displayName: 'Rindu Putri' }],
      ),
    ).toBe('Rindu Putri');
    expect(employeeDisplayName({ contributions: [] }, 'missing-id', [], 'Karyawan tidak tersedia')).toBe(
      'Karyawan tidak tersedia',
    );
  });
});
