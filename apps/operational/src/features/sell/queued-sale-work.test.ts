import { describe, expect, it } from 'vitest';

import type { Sale } from './cashier-transaction.types';
import { hasStartableQueuedWork } from './queued-sale-work';

const SALE_ID = '33333333-3333-4333-8333-333333333333';
const LINE_ID = '44444444-4444-4444-8444-444444444444';

function queuedSale(
  fulfillmentBehaviorSnapshot: 'INSTANT' | 'TRACKED',
  fulfillmentStatus?: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED',
): Sale {
  return {
    id: SALE_ID,
    sellingLocationId: '11111111-1111-4111-8111-111111111111',
    currency: 'IDR',
    status: 'OPEN',
    operationalState: 'QUEUED',
    version: 3,
    grossAmount: '125000.0000',
    discountAmount: '0.0000',
    netPreTaxAmount: '125000.0000',
    taxAmount: '0.0000',
    totalAmount: '125000.0000',
    orderDiscountType: null,
    orderDiscountValue: null,
    orderDiscountReason: null,
    orderDiscountAmount: '0.0000',
    finalizedAt: null,
    voidedAt: null,
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:01:00.000Z',
    lines: [
      {
        id: LINE_ID,
        saleId: SALE_ID,
        catalogItemId: '22222222-2222-4222-8222-222222222222',
        catalogVariantId: null,
        catalogPriceId: '55555555-5555-4555-8555-555555555555',
        itemCodeSnapshot: 'HAIRCUT',
        itemNameSnapshot: 'Hair Cut',
        itemTypeSnapshot: 'SERVICE',
        variantCodeSnapshot: null,
        variantNameSnapshot: null,
        fulfillmentBehaviorSnapshot,
        employeeAssignmentModeSnapshot: 'NONE',
        allowEmployeeContributionSnapshot: false,
        defaultDurationMinutesSnapshot: 30,
        quantity: '1.0000',
        currency: 'IDR',
        resolvedUnitPrice: '125000.0000',
        effectiveUnitPrice: '125000.0000',
        overrideAmount: null,
        overrideReason: null,
        discountType: null,
        discountValue: null,
        discountReason: null,
        grossAmount: '125000.0000',
        lineDiscountAmount: '0.0000',
        orderDiscountAllocationAmount: '0.0000',
        discountedCustomerBaseAmount: '125000.0000',
        includedTaxAmount: '0.0000',
        excludedTaxAmount: '0.0000',
        netPreTaxAmount: '125000.0000',
        taxAmount: '0.0000',
        totalAmount: '125000.0000',
        removedAt: null,
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z',
        fulfillment:
          fulfillmentBehaviorSnapshot === 'TRACKED' && fulfillmentStatus
            ? {
                saleId: SALE_ID,
                saleLineId: LINE_ID,
                status: fulfillmentStatus,
                startedAt: fulfillmentStatus === 'WAITING' ? null : '2026-09-14T00:02:00.000Z',
                completedAt:
                  fulfillmentStatus === 'COMPLETED' ? '2026-09-14T00:03:00.000Z' : null,
                canceledAt:
                  fulfillmentStatus === 'CANCELED' ? '2026-09-14T00:03:00.000Z' : null,
              }
            : null,
        participations: [],
        contributions: [],
      },
    ],
    payments: [],
  };
}

describe('hasStartableQueuedWork', () => {
  it('allows the Start Work affordance for authoritative QUEUED tracked WAITING work', () => {
    expect(hasStartableQueuedWork(queuedSale('TRACKED', 'WAITING'))).toBe(true);
  });

  it('does not advertise Start Work for a QUEUED Sale without startable tracked work', () => {
    expect(hasStartableQueuedWork(queuedSale('INSTANT'))).toBe(false);
    expect(hasStartableQueuedWork(queuedSale('TRACKED', 'IN_PROGRESS'))).toBe(false);
  });
});
