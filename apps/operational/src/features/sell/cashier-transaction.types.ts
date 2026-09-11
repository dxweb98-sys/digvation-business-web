export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type CatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type SaleStatus = 'OPEN' | 'FINALIZED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WALLET' | 'QRIS';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type FulfillmentStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type EmployeeAssignmentMode = 'NONE' | 'OPTIONAL' | 'REQUIRED';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

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

export interface Employee {
  id: string;
  code: string;
  displayName: string;
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

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE';
  categoryId: string | null;
  taxCategoryId: string | null;
  description: string | null;
  lifecycle: CatalogLifecycle;
  fulfillmentBehavior: 'INSTANT' | 'TRACKED';
  version: number;
  createdAt: string;
  updatedAt: string;
  serviceDefinition: ServiceDefinition | null;
  displayPrice?: CatalogDisplayPrice | null;
}

export interface CatalogVariant extends NamedRecord {
  catalogItemId: string;
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
  idempotencyKey: string;
  createdByActorId: string;
  createdByActorKind: string;
  settledByActorId: string | null;
  settledByActorKind: string | null;
  terminalAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  itemTypeSnapshot: 'PRODUCT' | 'SERVICE';
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
  discountType: DiscountType | null;
  discountValue: string | null;
  discountReason: string | null;
  grossAmount: string;
  lineDiscountAmount: string;
  orderDiscountAllocationAmount: string;
  discountedCustomerBaseAmount: string;
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
}

export interface Sale {
  id: string;
  sellingLocationId: string;
  currency: string;
  status: SaleStatus;
  version: number;
  grossAmount: string;
  discountAmount: string;
  netPreTaxAmount: string;
  taxAmount: string;
  totalAmount: string;
  orderDiscountType: DiscountType | null;
  orderDiscountValue: string | null;
  orderDiscountReason: string | null;
  orderDiscountAmount: string;
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
