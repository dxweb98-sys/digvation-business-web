import { describe, expect, it } from 'vitest';

import {
  normalizeOperationalSaleDetail,
  type OperationalSaleDetailPayload,
} from './transaction-history-api';

describe('normalizeOperationalSaleDetail', () => {
  it('normalizes missing aggregate collections so legacy transaction detail cannot crash presentation', () => {
    const payload = {
      id: 'sale-1',
      saleNumber: 'SALE-001',
      invoiceNumber: null,
      sellingLocationId: 'location-1',
      currency: 'IDR',
      status: 'FINALIZED',
      totalAmount: '100000.0000',
      createdAt: '2026-09-17T00:00:00.000Z',
      finalizedAt: '2026-09-17T00:05:00.000Z',
      operationalState: 'UNSUBMITTED',
      version: 1,
      grossAmount: '100000.0000',
      discountAmount: '0.0000',
      netPreTaxAmount: '100000.0000',
      taxAmount: '0.0000',
      orderDiscountType: null,
      orderDiscountValue: null,
      orderDiscountReason: null,
      orderDiscountActorId: null,
      orderDiscountActorKind: null,
      orderDiscountAmount: '0.0000',
      transactionTaxRuleId: null,
      transactionTaxCode: null,
      transactionTaxName: null,
      transactionTaxRate: null,
      transactionTaxTreatment: null,
      transactionTaxBaseAmount: '0.0000',
      transactionTaxAmount: '0.0000',
      promotionCode: null,
      createdByActorId: 'actor-1',
      createdByActorKind: 'USER',
      voidedAt: null,
      updatedAt: '2026-09-17T00:05:00.000Z',
    } as OperationalSaleDetailPayload;

    const normalized = normalizeOperationalSaleDetail(payload);

    expect(normalized.adjustments).toEqual([]);
    expect(normalized.lines).toEqual([]);
    expect(normalized.payments).toEqual([]);
  });

  it('normalizes nested participation and contribution collections without changing monetary facts', () => {
    const payload = {
      id: 'sale-1',
      saleNumber: 'SALE-001',
      invoiceNumber: null,
      sellingLocationId: 'location-1',
      currency: 'IDR',
      status: 'OPEN',
      totalAmount: '90000.0000',
      createdAt: '2026-09-17T00:00:00.000Z',
      finalizedAt: null,
      operationalState: 'UNSUBMITTED',
      version: 2,
      grossAmount: '100000.0000',
      discountAmount: '10000.0000',
      netPreTaxAmount: '90000.0000',
      taxAmount: '0.0000',
      orderDiscountType: null,
      orderDiscountValue: null,
      orderDiscountReason: null,
      orderDiscountActorId: null,
      orderDiscountActorKind: null,
      orderDiscountAmount: '0.0000',
      transactionTaxRuleId: null,
      transactionTaxCode: null,
      transactionTaxName: null,
      transactionTaxRate: null,
      transactionTaxTreatment: null,
      transactionTaxBaseAmount: '0.0000',
      transactionTaxAmount: '0.0000',
      promotionCode: null,
      adjustments: [],
      createdByActorId: 'actor-1',
      createdByActorKind: 'USER',
      voidedAt: null,
      updatedAt: '2026-09-17T00:05:00.000Z',
      lines: [
        {
          id: 'line-1',
          grossAmount: '100000.0000',
          lineDiscountAmount: '10000.0000',
        },
      ],
      payments: [],
    } as unknown as OperationalSaleDetailPayload;

    const normalized = normalizeOperationalSaleDetail(payload);

    expect(normalized.lines[0]?.participations).toEqual([]);
    expect(normalized.lines[0]?.contributions).toEqual([]);
    expect(normalized.lines[0]?.grossAmount).toBe('100000.0000');
    expect(normalized.lines[0]?.lineDiscountAmount).toBe('10000.0000');
  });
});