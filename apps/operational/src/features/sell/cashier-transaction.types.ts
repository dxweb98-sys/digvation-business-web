import type {
  CatalogItemType,
  VariantSelectionMode,
} from '@digvation/business-catalog';

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type CatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type SaleStatus = 'OPEN' | 'FINALIZED' | 'VOIDED';
export type SaleOperationalState = 'UNSUBMITTED' | 'QUEUED' | 'IN_PROGRESS';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';
export interface PaymentRoute {
  id: string;
  sellingLocationId: string;
  paymentMethod: PaymentMethod;
  currency: string;
  financialAccountId: string;
  financialAccountCode: string | null;
  financialAccountName: string;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type FulfillmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type EmployeeAssignmentMode = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type TaxTreatment = 'INCLUDED' | 'EXCLUDED';

export interface ApiPage<T> {
  items: T[];
  limit: number;
  offset: number;
}

export interface NamedRecord {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type SellingLocation = NamedRecord;
export type CatalogCategory = NamedRecord;

export interface EmployeePosition {
  id: string;
  code: string;
  name: string;
  serviceAssignmentEnabled: boolean;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  code: string;
  displayName: string;
  positionId?: string | null;
  position?: EmployeePosition | null;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDefinition {
  defaultDurationMinutes: number | null;
  employeeAssignmentMode: EmployeeAssignmentMode;
  allowEmployeeContribution: boolean;
}

export interface CatalogDisplayPrice {
  amount: string;
  currency: string;
  kind: 'EXACT' | 'FROM';
}

export interface CatalogItemImage {
  catalogItemId: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  updatedAt: string;
  url: string;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: CatalogItemType;
  categoryId: string | null;
  description: string | null;
  lifecycle: CatalogLifecycle;
  fulfillmentBehavior: 'INSTANT' | 'TRACKED';
  /** With active variants: REQUIRED sells variants only; OPTIONAL also sells the item itself. */
  variantSelectionMode?: VariantSelectionMode;
  version: number;
  createdAt: string;
  updatedAt: string;
  serviceDefinition: ServiceDefinition | null;
  displayPrice?: CatalogDisplayPrice | null;
  image?: CatalogItemImage | null;
  resolvedPrice?: ResolvedPrice | null;
  variants?: CatalogVariant[];
}

export interface CatalogVariant extends NamedRecord {
  catalogItemId: string;
  resolvedPrice?: ResolvedPrice | null;
}

export interface ResolvedPrice {
  catalogPriceId: string;
  catalogItemId: string;
  catalogVariantId: string | null;
  locationId: string | null;
  currency: string;
  amount: string;
  effectiveAt: string;
  sourceScope: {
    catalogVariantId: string | null;
    locationId: string | null;
  };
}

export interface OperationalCatalogProjection {
  categories: CatalogCategory[];
  items: CatalogItem[];
}

export interface SaleLineFulfillment {
  saleId: string;
  saleLineId: string;
  status: FulfillmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
}

export interface SaleParticipation {
  saleId: string;
  saleLineId: string;
  employeeId: string;
  assigned: boolean;
  shareRate: string | null;
}

/** One unit of a service line's quantity and the employees who perform it. */
export interface SaleLineWorkUnit {
  unitNumber: number;
  employeeIds: string[];
  /** Contribution share of the unit per employee; null share means an equal split. */
  performers?: Array<{ employeeId: string; shareRate: string | null }>;
}

export interface EmployeeContribution {
  saleId: string;
  saleLineId: string;
  employeeId: string;
  employeeCodeSnapshot: string;
  employeeDisplayNameSnapshot: string;
  shareRate: string;
  contributionBaseAmount: string;
  contributionAmount: string;
  finalizedAt: string;
}

export interface Payment {
  id: string;
  saleId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  currency: string;
  appliedAmount: string;
  tenderedAmount: string | null;
  changeAmount: string | null;
  providerReference: string | null;
  financePaymentRouteId?: string | null;
  financeFinancialAccountId?: string | null;
  financeFinancialAccountCodeSnapshot?: string | null;
  financeFinancialAccountNameSnapshot?: string | null;
  idempotencyKey: string;
  createdByActorId: string;
  createdByActorKind: string;
  settledByActorId: string | null;
  settledByActorKind: string | null;
  terminalAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleAdjustment {
  id: string;
  source: 'PROMOTION' | 'MANUAL_DISCOUNT';
  scope: 'ITEM' | 'CATEGORY' | 'TRANSACTION';
  type: DiscountType;
  configuredValue: string;
  requestedValue: string | null;
  actualAmount: string;
  promotionId: string | null;
  promotionEffectiveFrom?: string | null;
  promotionEffectiveUntil?: string | null;
  label: string;
  saleLineId: string | null;
  actorId: string | null;
  actorKind: string | null;
  reason: string | null;
  createdAt: string;
}

export interface ContributionPreviewAmount {
  employeeId: string;
  contributionAmount: string;
}

export interface ContributionPreview {
  saleId: string;
  saleLineId: string;
  version: number;
  contributionBaseAmount: string;
  preview: ContributionPreviewAmount[];
  facts: EmployeeContribution[];
}

export interface SaleLine {
  id: string;
  saleId: string;
  catalogItemId: string;
  catalogVariantId: string | null;
  catalogPriceId: string;
  itemCodeSnapshot: string;
  itemNameSnapshot: string;
  itemTypeSnapshot: CatalogItemType;
  variantCodeSnapshot: string | null;
  variantNameSnapshot: string | null;
  fulfillmentBehaviorSnapshot: 'INSTANT' | 'TRACKED';
  employeeAssignmentModeSnapshot: EmployeeAssignmentMode | null;
  allowEmployeeContributionSnapshot: boolean;
  defaultDurationMinutesSnapshot: number | null;
  quantity: string;
  currency: string;
  resolvedUnitPrice: string;
  effectiveUnitPrice: string;
  overrideAmount: string | null;
  overrideReason: string | null;
  overrideActorId?: string | null;
  overrideActorKind?: string | null;
  discountType: DiscountType | null;
  discountValue: string | null;
  discountReason: string | null;
  discountActorId?: string | null;
  discountActorKind?: string | null;
  itemTaxRuleId?: string | null;
  itemTaxCode?: string | null;
  itemTaxName?: string | null;
  itemTaxRate?: string | null;
  itemTaxTreatment?: TaxTreatment | null;
  grossAmount: string;
  lineDiscountAmount: string;
  orderDiscountAllocationAmount: string;
  discountedCustomerBaseAmount: string;
  itemTaxAmount?: string;
  transactionTaxBaseAmount?: string;
  transactionTaxAmount?: string;
  includedTaxAmount: string;
  excludedTaxAmount: string;
  netPreTaxAmount: string;
  taxAmount: string;
  totalAmount: string;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fulfillment: SaleLineFulfillment | null;
  participations: SaleParticipation[];
  contributions: EmployeeContribution[];
  /** Runtime per-quantity plan; empty or absent when assigned at line level. */
  workUnits?: SaleLineWorkUnit[];
}

export type SaleCustomerType = 'MEMBER' | 'NON_MEMBER';

/**
 * The Customer a Sale belongs to, as captured on the Sale itself.
 *
 * This is the only authority for who a transaction belongs to. It survives
 * reload, cashier change and tab change because it lives on the Sale, never in
 * browser storage. `null` on a Sale means the Sale was captured before this
 * contract existed: unknown history, never a general customer.
 */
export interface SaleCustomer {
  type: SaleCustomerType;
  referenceId: string | null;
  name: string;
  phoneE164: string;
}

/** Customer identity requested from Runtime, which resolves and normalizes it. */
export type SaleCustomerSelection =
  { type: 'NON_MEMBER'; name: string; phone: string } | { type: 'MEMBER'; referenceId: string };

export interface SaleLoyaltyRedemption {
  membershipId: string;
  points: string;
  pointValue: string;
  amount: string;
}

export interface Sale {
  id: string;
  saleNumber?: string;
  invoiceNumber?: string | null;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  operationalState: SaleOperationalState;
  version: number;
  grossAmount: string;
  discountAmount: string;
  netPreTaxAmount: string;
  taxAmount: string;
  totalAmount: string;
  orderDiscountType: DiscountType | null;
  orderDiscountValue: string | null;
  orderDiscountReason: string | null;
  orderDiscountActorId?: string | null;
  orderDiscountActorKind?: string | null;
  orderDiscountAmount: string;
  transactionTaxRuleId?: string | null;
  transactionTaxCode?: string | null;
  transactionTaxName?: string | null;
  transactionTaxRate?: string | null;
  transactionTaxTreatment?: TaxTreatment | null;
  transactionTaxBaseAmount?: string;
  transactionTaxAmount?: string;
  promotionCode?: string | null;
  adjustments?: SaleAdjustment[];
  loyaltyRedemption?: SaleLoyaltyRedemption | null;
  customer?: SaleCustomer | null;
  createdByActorId?: string;
  createdByActorKind?: string;
  finalizedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SaleLine[];
  payments: Payment[];
}

export interface OpenSaleSummaryViewModel {
  id: string;
  sellingLocationId: string;
  locationName: string;
  totalAmount: string;
  currency: string;
  activeLineCount: number;
  updatedAt: string;
}

/**
 * A completed transaction as Runtime shows it to a caller without
 * `sales:read-completed`: recognizable for follow-up, with no amounts, lines,
 * payments or receipt content.
 */
export interface CompletedSaleSummary {
  visibility: 'SUMMARY';
  id: string;
  saleNumber: string;
  invoiceNumber: string | null;
  sellingLocationId: string;
  status: 'FINALIZED';
  operationalState: SaleOperationalState;
  customer: Pick<SaleCustomer, 'type' | 'name'> | null;
  itemCount: number;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One entry of the Operational queue: a full Sale, or a completed-sale summary. */
export type QueueSale = Sale | CompletedSaleSummary;
