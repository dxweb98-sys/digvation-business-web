import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../../shared/api/build-query-string';

export type SaleStatus = 'OPEN' | 'FINALIZED' | 'VOIDED';
export type SaleOperationalState = 'UNSUBMITTED' | 'QUEUED' | 'IN_PROGRESS';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';
export type FulfillmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

/**
 * What a payment fact IS, decided by Runtime: money received, money returned, or one leg of a
 * payment correction. Never inferred from the sign of the amount.
 */
export type PaymentKind = 'PAYMENT' | 'REFUND' | 'CORRECTION_IN' | 'CORRECTION_OUT';

/** The manual refund a negative payment records: its disbursement is the payment's own route. */
export interface PaymentRefundRecord {
  id: string;
  kind: 'MANUAL';
  reason: 'ORDER_ADJUSTMENT' | 'SALE_VOID';
  externalReference: string | null;
  note: string | null;
  adjustmentId: string | null;
  allocations: Array<{ sourcePaymentId: string; amount: string }>;
}

export interface Payment {
  id: string;
  /** Runtime always sends it; readers go through `paymentKind()` so a gap is handled once. */
  kind?: PaymentKind;
  /** The payment correction this fact is a leg of; null for payments and refunds. */
  correction?: { id: string; leg: 'OUT' | 'IN' } | null;
  /** Set on a manual refund: why and how it was returned, and which payments it was attributed to. */
  refund?: PaymentRefundRecord | null;
  method: PaymentMethod;
  status: PaymentStatus;
  currency: string;
  /** Exact decimal string; negative for a refund or a correction-out leg. */
  appliedAmount: string;
  tenderedAmount: string | null;
  changeAmount: string | null;
  providerReference: string | null;
  /** Set on a refund fact: the payment it compensates. */
  refundOfPaymentId?: string | null;
  financePaymentRouteId?: string | null;
  financeFinancialAccountId?: string | null;
  financeFinancialAccountCodeSnapshot?: string | null;
  financeFinancialAccountNameSnapshot?: string | null;
  terminalAt: string | null;
  createdAt: string;
}

export interface PaymentCorrectionMovement {
  paymentId: string;
  leg: 'OUT' | 'IN';
  method: PaymentMethod;
  paymentRouteId: string;
  financialAccountId: string;
  financialAccountCode: string | null;
  financialAccountName: string | null;
  /** Signed: negative for OUT, positive for IN. */
  amount: string;
}

/** One payment correction: the recording was wrong, the money was not. */
export interface PaymentCorrection {
  id: string;
  reason: string;
  correctsCorrectionId: string | null;
  /** A source payment was already in a COMPLETED settlement; that settlement is untouched. */
  afterSettlement: boolean;
  createdBy: string | null;
  createdByPresence: 'USER' | 'SYSTEM' | 'UNAVAILABLE' | null;
  createdAt: string;
  movements: PaymentCorrectionMovement[];
  allocations: Array<{ outPaymentId: string; sourcePaymentId: string; amount: string }>;
}

export interface PaymentCompositionEntry {
  method: PaymentMethod;
  paymentRouteId: string | null;
  financialAccountId: string | null;
  financialAccountCode: string | null;
  financialAccountName: string | null;
  receivedAmount: string;
  refundedAmount: string;
  effectiveAmount: string;
}

/** Runtime's effective payment composition after payments, refunds and corrections. */
export interface PaymentComposition {
  entries: PaymentCompositionEntry[];
  totalReceived: string;
  totalRefunded: string;
  totalPaid: string;
}

/** An active payment route a correction may attribute money to. */
export interface CorrectionRoute {
  id: string;
  paymentMethod: PaymentMethod;
  currency: string;
  financialAccountName: string;
}

export interface PaymentCorrectionRequest {
  expectedVersion: number;
  reason: string;
  moves: Array<{ paymentRouteId: string; delta: string }>;
}

export interface SaleReversal {
  reason: string;
  reversedAt: string;
  reversedByActorId?: string | null;
}

export interface SaleLoyaltyRedemption {
  membershipId: string;
  points: string;
  pointValue: string;
  amount: string;
}

export interface SaleLineFulfillment {
  status: FulfillmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
}

export interface SaleParticipation {
  employeeId: string;
  assigned: boolean;
  shareRate: string | null;
}

export interface SaleLineWorkUnit {
  unitNumber: number;
  employeeIds: string[];
}

/** Immutable finalized work fact; its snapshots are the historical identity. */
export interface EmployeeContribution {
  employeeId: string;
  employeeCodeSnapshot: string;
  employeeDisplayNameSnapshot: string;
}

export type ComponentPricingMode =
  'INCLUDED_IN_SERVICE_PRICE' | 'FOLLOW_PRODUCT_PRICE' | 'FIXED_COMPONENT_PRICE';

export interface SaleLineCompositionComponent {
  id: string;
  position: number;
  componentSource: 'FIXED_BOM' | 'SALE_SELECTED';
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  /** Composition quantity per Service unit. */
  quantity: string;
  pricingMode: ComponentPricingMode;
  extendedContribution: string;
  performers: { employeeId: string; shareRate: string }[];
  contributions: EmployeeContribution[];
}

/** A captured Promotion or manual discount outcome; `actualAmount` is what it took off. */
export interface SaleAdjustment {
  id: string;
  source: 'PROMOTION' | 'MANUAL_DISCOUNT';
  scope: 'ITEM' | 'CATEGORY' | 'TRANSACTION';
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  configuredValue: string;
  requestedValue: string | null;
  actualAmount: string;
  label: string;
  saleLineId: string | null;
  reason: string | null;
  createdAt: string;
}

/** Line points: a current-rule preview while OPEN, immutable history once finalized. */
export interface SaleLineLoyaltyEarning {
  state: 'PREVIEW' | 'FINALIZED';
  pointsEarned: string;
}

export interface SaleLine {
  id: string;
  itemTypeSnapshot?: 'PRODUCT' | 'SERVICE';
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: string;
  /** Captured composed unit price (Service base + composition contributions), before any override. */
  resolvedUnitPrice?: string;
  /** Manual unit price that replaced the resolved price, when one was applied. */
  overrideAmount?: string | null;
  effectiveUnitPrice?: string;
  grossAmount?: string;
  lineDiscountAmount?: string;
  orderDiscountAllocationAmount?: string;
  /** After every discount and point allocation of this line (Runtime amount). */
  discountedCustomerBaseAmount?: string;
  totalAmount?: string;
  netPreTaxAmount: string;
  soldByEmployeeId?: string | null;
  soldByEmployeeCodeSnapshot?: string | null;
  soldByEmployeeNameSnapshot?: string | null;
  fulfillmentBehaviorSnapshot: 'INSTANT' | 'TRACKED';
  /** Retired by removal or correction; never part of the billed items. */
  removedAt?: string | null;
  correctedFromLineId?: string | null;
  fulfillment: SaleLineFulfillment | null;
  participations?: SaleParticipation[];
  workUnits?: SaleLineWorkUnit[];
  contributions?: EmployeeContribution[];
  compositionComponents?: SaleLineCompositionComponent[];
  loyaltyEarning?: SaleLineLoyaltyEarning | null;
}

export interface SaleCustomer {
  type: 'MEMBER' | 'NON_MEMBER';
  name: string;
}

/** Historical point outcome of a finalized member Sale (balance right after it). */
export interface SaleLoyaltySummary {
  earnedPoints: string;
  redeemedPoints: string;
  balanceAfter: string;
}

/** Readable identity of employees named on planned work, projected by the Sale read. */
export interface SaleWorkEmployee {
  id: string;
  code: string;
  displayName: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  invoiceNumber: string | null;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  operationalState?: SaleOperationalState;
  version: number;
  grossAmount: string;
  totalAmount: string;
  taxAmount: string;
  discountAmount: string;
  createdAt: string;
  finalizedAt: string | null;
  voidedAt: string | null;
  customer?: SaleCustomer | null;
  reversal?: SaleReversal | null;
  loyaltyRedemption?: SaleLoyaltyRedemption | null;
  /** Points the finalized Sale earned (immutable ledger fact); never a preview. */
  loyaltyEarning?: { state: 'FINALIZED'; pointsEarned: string } | null;
  loyaltySummary?: SaleLoyaltySummary | null;
  promotionCode?: string | null;
  adjustments?: SaleAdjustment[];
  lines: SaleLine[];
  payments: Payment[];
  paymentCorrections?: PaymentCorrection[];
  paymentComposition?: PaymentComposition;
  workEmployees?: SaleWorkEmployee[];
}

interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Runtime list filters. `paymentStatus` and `fulfillmentStatus` match a Sale that has at least
 * one payment attempt / tracked line with that raw status.
 */
export interface TransactionHistoryQuery {
  q?: string;
  saleStatus?: SaleStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  createdFrom?: string;
  createdTo?: string;
  limit: number;
  offset: number;
}

export class TransactionHistoryApi {
  constructor(private readonly client: ApiClient) {}

  list(query: TransactionHistoryQuery) {
    return this.client.get<Page<Sale>>(`/api/v1/sales?${buildQueryString(query)}`);
  }
  get(id: string) {
    return this.client.get<Sale>(`/api/v1/sales/${id}`);
  }
  refundPayment(saleId: string, paymentId: string, expectedVersion: number, amount: string) {
    return this.client.post<Sale>(
      `/api/v1/sales/${saleId}/payments/${paymentId}/refund`,
      { expectedVersion, amount },
      { headers: { 'idempotency-key': crypto.randomUUID() } },
    );
  }
  /** Active payment routes of the Sale's location, so money can be attributed to any of them. */
  async paymentRoutes(sellingLocationId: string, currency: string) {
    const page = await this.client.get<{ items: CorrectionRoute[] }>(
      `/api/v1/sales/payment-routes?${buildQueryString({ sellingLocationId, currency })}`,
    );
    return page.items;
  }
  /**
   * The one payment-correction command, shared with Operational. The key stays the same for the
   * same exact request, so a retry never corrects twice.
   */
  correctPayments(saleId: string, input: PaymentCorrectionRequest, idempotencyKey: string) {
    return this.client.post<Sale>(`/api/v1/sales/${saleId}/payment-corrections`, input, {
      headers: { 'idempotency-key': idempotencyKey },
    });
  }
  reverse(saleId: string, expectedVersion: number, reason: string) {
    return this.client.post<Sale>(
      `/api/v1/sales/${saleId}/reverse`,
      { expectedVersion, reason },
      { headers: { 'idempotency-key': crypto.randomUUID() } },
    );
  }
}
