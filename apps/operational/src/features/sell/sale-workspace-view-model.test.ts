import { describe, expect, it } from 'vitest';

import type { Payment, Sale, SaleLine } from './cashier-transaction.types';
import { createSaleWorkspaceViewModel } from './sale-workspace-view-model';

const SALE_ID = '33333333-3333-4333-8333-333333333333';
const LINE_ID = '44444444-4444-4444-8444-444444444444';
const EMPLOYEE_ID = '66666666-6666-4666-8666-666666666666';

function createLine(overrides: Partial<SaleLine> = {}): SaleLine {
  return {
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
    fulfillmentBehaviorSnapshot: 'INSTANT',
    employeeAssignmentModeSnapshot: 'NONE',
    allowEmployeeContributionSnapshot: false,
    defaultDurationMinutesSnapshot: null,
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
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    fulfillment: null,
    participations: [],
    contributions: [],
    ...overrides,
  };
}

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    saleId: SALE_ID,
    method: 'CASH',
    status: 'SUCCEEDED',
    currency: 'IDR',
    appliedAmount: '125000.0000',
    tenderedAmount: '150000.0000',
    changeAmount: '25000.0000',
    providerReference: null,
    idempotencyKey: 'cashier-payment-test',
    createdByActorId: '88888888-8888-4888-8888-888888888888',
    createdByActorKind: 'USER',
    settledByActorId: null,
    settledByActorKind: null,
    terminalAt: '2026-09-02T00:01:00.000Z',
    createdAt: '2026-09-02T00:01:00.000Z',
    updatedAt: '2026-09-02T00:01:00.000Z',
    ...overrides,
  };
}

function createSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: SALE_ID,
    sellingLocationId: '11111111-1111-4111-8111-111111111111',
    currency: 'IDR',
    status: 'OPEN',
    version: 2,
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
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    lines: [createLine()],
    payments: [],
    ...overrides,
  };
}

describe('createSaleWorkspaceViewModel', () => {
  it('derives payment amounts without becoming client monetary authority', () => {
    const viewModel = createSaleWorkspaceViewModel(
      createSale({
        payments: [
          createPayment({ appliedAmount: '50000.0000' }),
          createPayment({
            id: '99999999-9999-4999-8999-999999999999',
            method: 'QRIS',
            status: 'PENDING',
            appliedAmount: '25000.0000',
            tenderedAmount: null,
            changeAmount: null,
            terminalAt: null,
          }),
        ],
      }),
      'ONLINE',
      'CLEAN',
    );

    expect(viewModel.paidAmount).toBe('50000.0000');
    expect(viewModel.pendingAmount).toBe('25000.0000');
    expect(viewModel.availableToPay).toBe('50000.0000');
  });

  it('blocks monetary changes for pending payment but keeps operational work available', () => {
    const viewModel = createSaleWorkspaceViewModel(
      createSale({
        payments: [
          createPayment({
            method: 'QRIS',
            status: 'PENDING',
            tenderedAmount: null,
            changeAmount: null,
            terminalAt: null,
          }),
        ],
      }),
      'ONLINE',
      'CLEAN',
    );

    expect(viewModel.primaryMode).toBe('PAYMENT_PENDING_ATTENTION');
    expect(viewModel.monetaryMutation).toEqual({
      state: 'DISABLED',
      reason: 'PAYMENT_PENDING',
    });
    expect(viewModel.operationalMutation).toEqual({ state: 'AVAILABLE' });
  });

  it('keeps a fully paid Sale open when tracked work is incomplete', () => {
    const trackedLine = createLine({
      fulfillmentBehaviorSnapshot: 'TRACKED',
      employeeAssignmentModeSnapshot: 'REQUIRED',
      fulfillment: {
        saleId: SALE_ID,
        saleLineId: LINE_ID,
        status: 'IN_PROGRESS',
        startedAt: '2026-09-02T00:02:00.000Z',
        completedAt: null,
        canceledAt: null,
      },
      participations: [
        {
          saleId: SALE_ID,
          saleLineId: LINE_ID,
          employeeId: EMPLOYEE_ID,
          assigned: true,
          shareRate: null,
        },
      ],
    });

    const viewModel = createSaleWorkspaceViewModel(
      createSale({ lines: [trackedLine], payments: [createPayment()] }),
      'ONLINE',
      'CLEAN',
    );

    expect(viewModel.primaryMode).toBe('PAID_WORK_REMAINING');
    expect(viewModel.availableToPay).toBe('0.0000');
    expect(viewModel.domainReadiness.ready).toBe(false);
    expect(viewModel.domainReadiness.blockers.map((blocker) => blocker.code)).toContain(
      'FULFILLMENT_INCOMPLETE',
    );
  });

  it('requires assignment and contribution when captured service semantics require them', () => {
    const line = createLine({
      fulfillmentBehaviorSnapshot: 'TRACKED',
      employeeAssignmentModeSnapshot: 'REQUIRED',
      allowEmployeeContributionSnapshot: true,
      fulfillment: {
        saleId: SALE_ID,
        saleLineId: LINE_ID,
        status: 'COMPLETED',
        startedAt: '2026-09-02T00:02:00.000Z',
        completedAt: '2026-09-02T00:03:00.000Z',
        canceledAt: null,
      },
    });

    const viewModel = createSaleWorkspaceViewModel(
      createSale({ lines: [line], payments: [createPayment()] }),
      'ONLINE',
      'CLEAN',
    );

    expect(viewModel.domainReadiness.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(['ASSIGNMENT_REQUIRED', 'CONTRIBUTION_REQUIRED']),
    );
    expect(viewModel.finalizeMutation).toEqual({
      state: 'DISABLED',
      reason: 'DOMAIN_NOT_READY',
    });
  });

  it('becomes ready to finalize only after exact settlement and operational requirements', () => {
    const line = createLine({
      fulfillmentBehaviorSnapshot: 'TRACKED',
      employeeAssignmentModeSnapshot: 'REQUIRED',
      allowEmployeeContributionSnapshot: true,
      fulfillment: {
        saleId: SALE_ID,
        saleLineId: LINE_ID,
        status: 'COMPLETED',
        startedAt: '2026-09-02T00:02:00.000Z',
        completedAt: '2026-09-02T00:03:00.000Z',
        canceledAt: null,
      },
      participations: [
        {
          saleId: SALE_ID,
          saleLineId: LINE_ID,
          employeeId: EMPLOYEE_ID,
          assigned: true,
          shareRate: '1.000000000000000000',
        },
      ],
    });

    const viewModel = createSaleWorkspaceViewModel(
      createSale({ lines: [line], payments: [createPayment()] }),
      'ONLINE',
      'CLEAN',
    );

    expect(viewModel.primaryMode).toBe('READY_TO_FINALIZE');
    expect(viewModel.domainReadiness).toEqual({ ready: true, blockers: [] });
    expect(viewModel.finalizeMutation).toEqual({ state: 'AVAILABLE' });
  });

  it('treats conflict and offline conditions as execution overlays', () => {
    const conflict = createSaleWorkspaceViewModel(createSale(), 'ONLINE', 'CONFLICT_REVIEW');
    expect(conflict.primaryMode).toBe('CONFLICT_REVIEW');
    expect(conflict.operationalMutation).toEqual({
      state: 'DISABLED',
      reason: 'CONFLICT_REVIEW',
    });

    const offline = createSaleWorkspaceViewModel(createSale(), 'OFFLINE', 'CLEAN');
    expect(offline.monetaryMutation).toEqual({ state: 'DISABLED', reason: 'OFFLINE' });
    expect(offline.operationalMutation).toEqual({ state: 'DISABLED', reason: 'OFFLINE' });
    expect(offline.paymentMutation).toEqual({ state: 'DISABLED', reason: 'OFFLINE' });
  });

  it('allows void only for an OPEN Sale without pending or successful payment', () => {
    const unpaid = createSaleWorkspaceViewModel(createSale(), 'ONLINE', 'CLEAN');
    expect(unpaid.voidMutation).toEqual({ state: 'AVAILABLE' });

    const paid = createSaleWorkspaceViewModel(
      createSale({ payments: [createPayment()] }),
      'ONLINE',
      'CLEAN',
    );
    expect(paid.voidMutation).toEqual({ state: 'DISABLED', reason: 'NOT_VOIDABLE' });
  });
});
