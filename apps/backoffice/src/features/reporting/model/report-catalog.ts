import type { BadgeVariant } from '@digvation/ui';

import type { ReferenceSource } from '../api/reporting-api';
import type { ReportType } from './report-availability';

/** How a report value is presented. Explicit per field; never guessed from its name. */
export type ValueKind =
  | 'money'
  | 'signedMoney'
  | 'count'
  | 'quantity'
  | 'date'
  | 'datetime'
  | 'time'
  | 'percent'
  | 'text'
  | 'enum'
  | 'badge'
  /** A Runtime-resolved actor name; `<key>Presence` explains a missing one. Never an account id. */
  | 'actor';

/** Copy keys for Runtime enum values; the codes themselves are never shown. */
export const ENUM_LABELS = {
  saleStatus: { OPEN: 'Open', FINALIZED: 'Completed', VOIDED: 'Cancelled' },
  paymentStatus: {
    PENDING: 'Pending',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  },
  paymentMethod: { CASH: 'Cash', BANK_TRANSFER: 'Bank transfer', WALLET: 'E-wallet', QRIS: 'QRIS' },
  paymentKind: { PAYMENT: 'Payment', REFUND: 'Refund' },
  fulfillmentStatus: {
    WAITING: 'Waiting',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Completed',
    CANCELED: 'Cancelled',
  },
  itemType: { PRODUCT: 'Product', SERVICE: 'Service' },
  catalogLifecycle: {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    ARCHIVED: 'Archived',
  },
  recordStatus: { ACTIVE: 'Active', INACTIVE: 'Inactive' },
  attendanceStatus: { PRESENT: 'Present', ABSENT: 'Absent', LEAVE: 'Leave', SICK: 'Sick' },
  attendanceSource: { LOCAL: 'Recorded here', HRIS: 'HRIS' },
  expenseStatus: { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' },
  expenseOrigin: { BACKOFFICE: 'Backoffice', CASHIER: 'Operational' },
  cashMovementType: { CASH_IN: 'Cash in', CASH_OUT: 'Cash out' },
  componentSource: {
    FIXED_BOM: 'Configured component',
    SALE_SELECTED: 'Selected during transaction',
  },
  fixedBomSource: {
    SERVICE_DEFAULT: 'Service default',
    SERVICE_VARIANT_OVERRIDE: 'Service variant',
  },
  commissionEntry: { EARN: 'Commission earned', REVERSAL: 'Commission reversal' },
  commissionType: { FIXED_PER_UNIT: 'Fixed per unit' },
  taxTreatment: { INCLUDED: 'Included in price', EXCLUDED: 'Added to price' },
  yesNo: { YES: 'Yes', NO: 'No' },
} as const satisfies Record<string, Record<string, string>>;

export type EnumName = keyof typeof ENUM_LABELS;

export const BADGE_VARIANTS: Record<string, BadgeVariant> = {
  SUCCEEDED: 'success',
  APPROVED: 'success',
  PRESENT: 'success',
  EARN: 'success',
  PENDING: 'warning',
  LEAVE: 'warning',
  SICK: 'warning',
  FAILED: 'danger',
  REJECTED: 'secondary',
  ABSENT: 'secondary',
  CANCELLED: 'secondary',
  EXPIRED: 'secondary',
  REVERSAL: 'secondary',
  REFUND: 'info',
};

export interface ReportColumn {
  key: string;
  label: string;
  kind: ValueKind;
  enum?: EnumName;
  /** A quiet second line under the value (e.g. a code or variant). */
  secondaryKey?: string;
  secondaryKind?: ValueKind;
  /** Names the secondary line when it is not self-explanatory (e.g. "Updated by"). */
  secondaryLabel?: string;
  align?: 'left' | 'right';
}

export interface ReportKpi {
  key: string;
  label: string;
  kind: 'money' | 'signedMoney' | 'count' | 'quantity';
}

export interface ReportBreakdown {
  /** `analytics.breakdowns[key]`, or `breakdown` for `primary`. */
  key: string;
  title: string;
  /** Slice size: the money value, or the number of records. */
  measure: 'value' | 'count';
  enum?: EnumName;
}

export interface ReportAnalytics {
  trend?: { title: string; kind: 'money' | 'count' };
  breakdowns?: ReportBreakdown[];
  ranking?: { title: string; kind: 'money' | 'quantity' };
  /** Component usage only: the per-component fixed/selected usage table. */
  usageByComponent?: boolean;
}

export type ReportFilter =
  | { key: string; label: string; enum: EnumName }
  | { key: string; label: string; reference: ReferenceSource };

export type ReportDetail =
  'transaction' | 'component-usage' | 'product-commission' | 'payment' | 'tax' | 'employee';

export interface ReportDefinition {
  type: ReportType;
  label: string;
  /** Selling-location scoped; attendance belongs to the workforce, not a sale location. */
  locationScoped: boolean;
  kpis: ReportKpi[];
  analytics: ReportAnalytics;
  filters: ReportFilter[];
  /** Only for projections whose Runtime query actually applies `search`. */
  search?: { label: string };
  /** `null` for aggregate reports without a detailed record table. */
  columns: ReportColumn[] | null;
  detail: ReportDetail | null;
}

const money = (key: string, label: string): ReportColumn => ({
  key,
  label,
  kind: 'money',
  align: 'right',
});
const count = (key: string, label: string): ReportColumn => ({
  key,
  label,
  kind: 'count',
  align: 'right',
});
const quantity = (key: string, label: string): ReportColumn => ({
  key,
  label,
  kind: 'quantity',
  align: 'right',
});

/** The current Backoffice report catalog, in its intended reading order. */
export const REPORT_CATALOG: readonly ReportDefinition[] = [
  {
    type: 'business-performance',
    label: 'Business Performance',
    locationScoped: true,
    kpis: [
      { key: 'finalRevenue', label: 'Revenue', kind: 'money' },
      { key: 'transactionCount', label: 'Transactions', kind: 'count' },
      { key: 'averageTransactionValue', label: 'Average transaction', kind: 'money' },
      { key: 'quantitySold', label: 'Items sold', kind: 'quantity' },
      { key: 'approvedExpenses', label: 'Approved expenses', kind: 'money' },
      { key: 'netRevenue', label: 'Net revenue', kind: 'signedMoney' },
    ],
    analytics: {
      trend: { title: 'Revenue trend', kind: 'money' },
      breakdowns: [
        { key: 'paymentMethod', title: 'Payment mix', measure: 'value', enum: 'paymentMethod' },
      ],
    },
    filters: [],
    columns: null,
    detail: null,
  },
  {
    type: 'transactions',
    label: 'Transaction Report',
    locationScoped: true,
    kpis: [
      { key: 'transactionCount', label: 'Transactions', kind: 'count' },
      { key: 'finalRevenue', label: 'Revenue', kind: 'money' },
      { key: 'averageTransactionValue', label: 'Average transaction', kind: 'money' },
      { key: 'successfulPaymentAmount', label: 'Payments received', kind: 'money' },
    ],
    analytics: {
      trend: { title: 'Transaction revenue', kind: 'money' },
      breakdowns: [
        {
          key: 'paymentMethod',
          title: 'Payment method mix',
          measure: 'value',
          enum: 'paymentMethod',
        },
        {
          key: 'saleStatus',
          title: 'Revenue by transaction status',
          measure: 'value',
          enum: 'saleStatus',
        },
      ],
    },
    filters: [
      { key: 'saleStatus', label: 'Transaction status', enum: 'saleStatus' },
      { key: 'paymentMethod', label: 'Payment method', enum: 'paymentMethod' },
      { key: 'paymentStatus', label: 'Payment status', enum: 'paymentStatus' },
      { key: 'fulfillmentStatus', label: 'Work status', enum: 'fulfillmentStatus' },
    ],
    search: { label: 'Search transaction or invoice number' },
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'datetime' },
      { key: 'saleNumber', label: 'Transaction', kind: 'text', secondaryKey: 'invoiceNumber' },
      { key: 'sellingLocation', label: 'Location', kind: 'text' },
      { key: 'saleStatus', label: 'Status', kind: 'badge' },
      { key: 'createdBy', label: 'Created by', kind: 'actor' },
      money('total', 'Total'),
    ],
    detail: 'transaction',
  },
  {
    type: 'catalog-performance',
    label: 'Catalog Performance',
    locationScoped: true,
    kpis: [
      { key: 'finalRevenue', label: 'Revenue', kind: 'money' },
      { key: 'quantitySold', label: 'Items sold', kind: 'quantity' },
      { key: 'itemCount', label: 'Items with sales', kind: 'count' },
      { key: 'transactionCount', label: 'Transactions', kind: 'count' },
    ],
    analytics: { ranking: { title: 'Top items by revenue', kind: 'money' } },
    filters: [
      { key: 'catalogItemType', label: 'Item type', enum: 'itemType' },
      { key: 'catalogLifecycle', label: 'Catalog status', enum: 'catalogLifecycle' },
      { key: 'categoryId', label: 'Category', reference: 'categories' },
      { key: 'catalogItemId', label: 'Item', reference: 'catalogItems' },
    ],
    columns: [
      count('rank', '#'),
      { key: 'itemName', label: 'Item', kind: 'text', secondaryKey: 'itemCode' },
      count('transactionCount', 'Transactions'),
      quantity('quantitySold', 'Quantity'),
      money('finalRevenue', 'Revenue'),
      money('discountAmount', 'Discount'),
      money('taxAmount', 'Tax'),
      money('averageSellingValue', 'Average value'),
    ],
    detail: null,
  },
  {
    type: 'component-usage',
    label: 'Component Usage',
    locationScoped: true,
    kpis: [
      { key: 'transactionCount', label: 'Transactions', kind: 'count' },
      { key: 'componentCount', label: 'Components', kind: 'count' },
      { key: 'usageCount', label: 'Usages', kind: 'count' },
      { key: 'selectedUsageCount', label: 'Selected during transaction', kind: 'count' },
      { key: 'billedAdditionAmount', label: 'Billed additions', kind: 'money' },
    ],
    analytics: {
      trend: { title: 'Usage activity', kind: 'count' },
      breakdowns: [
        { key: 'source', title: 'Usage source', measure: 'count', enum: 'componentSource' },
      ],
      ranking: { title: 'Most used components', kind: 'quantity' },
      usageByComponent: true,
    },
    filters: [
      { key: 'componentSource', label: 'Usage source', enum: 'componentSource' },
      { key: 'componentItemId', label: 'Component', reference: 'catalogItems' },
      { key: 'catalogItemId', label: 'Service', reference: 'catalogItems' },
    ],
    search: { label: 'Search component or service' },
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'datetime' },
      { key: 'saleNumber', label: 'Transaction', kind: 'text', secondaryKey: 'sellingLocation' },
      { key: 'parentItemName', label: 'Service', kind: 'text', secondaryKey: 'parentVariantName' },
      {
        key: 'componentName',
        label: 'Component',
        kind: 'text',
        secondaryKey: 'componentVariantName',
      },
      { key: 'componentSource', label: 'Source', kind: 'enum', enum: 'componentSource' },
      quantity('usedQuantity', 'Used'),
      money('billedAmount', 'Billed'),
    ],
    detail: 'component-usage',
  },
  {
    type: 'product-commission',
    label: 'Product Commission',
    locationScoped: true,
    kpis: [
      { key: 'netCommission', label: 'Net commission', kind: 'signedMoney' },
      { key: 'earnedAmount', label: 'Commission earned', kind: 'money' },
      { key: 'reversedAmount', label: 'Commission reversed', kind: 'signedMoney' },
      { key: 'earnedQuantity', label: 'Units sold', kind: 'quantity' },
    ],
    analytics: { ranking: { title: 'Net commission by employee', kind: 'money' } },
    filters: [
      { key: 'commissionEntryType', label: 'Entry type', enum: 'commissionEntry' },
      { key: 'employeeId', label: 'Employee', reference: 'employees' },
      { key: 'catalogItemId', label: 'Product', reference: 'catalogItems' },
    ],
    search: { label: 'Search transaction, employee, or product' },
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'datetime' },
      { key: 'saleNumber', label: 'Transaction', kind: 'text', secondaryKey: 'sellingLocation' },
      { key: 'employeeName', label: 'Employee', kind: 'text', secondaryKey: 'employeeCode' },
      { key: 'productName', label: 'Product', kind: 'text', secondaryKey: 'variantName' },
      { key: 'entryType', label: 'Entry', kind: 'badge', enum: 'commissionEntry' },
      quantity('quantity', 'Quantity'),
      { key: 'commissionAmount', label: 'Commission', kind: 'signedMoney', align: 'right' },
    ],
    detail: 'product-commission',
  },
  {
    type: 'employee-performance',
    label: 'Employee Performance',
    locationScoped: true,
    kpis: [
      { key: 'contributionRevenue', label: 'Contribution revenue', kind: 'money' },
      { key: 'employeeCount', label: 'Employees', kind: 'count' },
      { key: 'contributedTransactions', label: 'Transactions', kind: 'count' },
      { key: 'contributedItems', label: 'Items worked', kind: 'count' },
    ],
    analytics: { ranking: { title: 'Top contributors', kind: 'money' } },
    filters: [
      { key: 'employeeStatus', label: 'Employee status', enum: 'recordStatus' },
      { key: 'employeeId', label: 'Employee', reference: 'employees' },
    ],
    columns: [
      count('rank', '#'),
      { key: 'employeeName', label: 'Employee', kind: 'text', secondaryKey: 'employeeCode' },
      count('contributedTransactions', 'Transactions'),
      count('contributedLineItems', 'Items worked'),
      money('contributionRevenue', 'Contribution revenue'),
      money('averageContributionPerTransaction', 'Average per transaction'),
      { key: 'topCatalogItem', label: 'Top item', kind: 'text' },
    ],
    detail: 'employee',
  },
  {
    type: 'attendance',
    label: 'Attendance Report',
    locationScoped: false,
    kpis: [
      { key: 'totalRecords', label: 'Records', kind: 'count' },
      { key: 'presentCount', label: 'Present', kind: 'count' },
      { key: 'absentCount', label: 'Absent', kind: 'count' },
      { key: 'leaveCount', label: 'Leave', kind: 'count' },
      { key: 'sickCount', label: 'Sick', kind: 'count' },
    ],
    analytics: {
      trend: { title: 'Attendance records', kind: 'count' },
      breakdowns: [
        { key: 'primary', title: 'Attendance status', measure: 'count', enum: 'attendanceStatus' },
      ],
    },
    filters: [
      { key: 'attendanceStatus', label: 'Attendance status', enum: 'attendanceStatus' },
      { key: 'attendanceSource', label: 'Source', enum: 'attendanceSource' },
      { key: 'employeeId', label: 'Employee', reference: 'employees' },
      { key: 'positionId', label: 'Position', reference: 'positions' },
    ],
    search: { label: 'Search employee code or name' },
    columns: [
      { key: 'attendanceDate', label: 'Date', kind: 'date' },
      { key: 'employeeName', label: 'Employee', kind: 'text', secondaryKey: 'employeeCode' },
      { key: 'position', label: 'Position', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge', enum: 'attendanceStatus' },
      { key: 'checkIn', label: 'Check-in', kind: 'time' },
      { key: 'checkOut', label: 'Check-out', kind: 'time' },
      { key: 'source', label: 'Source', kind: 'enum', enum: 'attendanceSource' },
      { key: 'note', label: 'Note', kind: 'text' },
      {
        key: 'recordedBy',
        label: 'Recorded by',
        kind: 'actor',
        secondaryKey: 'updatedBy',
        secondaryKind: 'actor',
        secondaryLabel: 'Updated by',
      },
    ],
    detail: null,
  },
  {
    type: 'payments',
    label: 'Payment Report',
    locationScoped: true,
    kpis: [
      { key: 'successfulAmount', label: 'Net received', kind: 'signedMoney' },
      { key: 'successfulPayments', label: 'Successful payments', kind: 'count' },
      { key: 'refundedAmount', label: 'Refunded', kind: 'money' },
      { key: 'failedPayments', label: 'Failed attempts', kind: 'count' },
    ],
    analytics: {
      trend: { title: 'Net received', kind: 'money' },
      breakdowns: [
        { key: 'method', title: 'Payment method mix', measure: 'value', enum: 'paymentMethod' },
      ],
    },
    filters: [
      { key: 'paymentStatus', label: 'Payment status', enum: 'paymentStatus' },
      { key: 'paymentMethod', label: 'Payment method', enum: 'paymentMethod' },
    ],
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'datetime' },
      { key: 'saleNumber', label: 'Transaction', kind: 'text', secondaryKey: 'sellingLocation' },
      {
        key: 'method',
        label: 'Method',
        kind: 'enum',
        enum: 'paymentMethod',
        secondaryKey: 'financialAccount',
      },
      { key: 'status', label: 'Status', kind: 'badge', enum: 'paymentStatus' },
      { key: 'processedBy', label: 'Processed by', kind: 'actor' },
      { key: 'appliedAmount', label: 'Amount', kind: 'signedMoney', align: 'right' },
    ],
    detail: 'payment',
  },
  {
    type: 'expenses',
    label: 'Expense Report',
    locationScoped: true,
    kpis: [
      { key: 'approvedExpenseTotal', label: 'Approved expenses', kind: 'money' },
      { key: 'expenseCount', label: 'Expenses', kind: 'count' },
      { key: 'pendingCount', label: 'Pending', kind: 'count' },
      { key: 'rejectedCount', label: 'Rejected', kind: 'count' },
    ],
    analytics: {
      trend: { title: 'Recorded expenses', kind: 'money' },
      breakdowns: [
        { key: 'primary', title: 'Expenses by status', measure: 'value', enum: 'expenseStatus' },
      ],
    },
    filters: [
      { key: 'status', label: 'Status', enum: 'expenseStatus' },
      { key: 'origin', label: 'Origin', enum: 'expenseOrigin' },
      { key: 'financialAccountId', label: 'Source account', reference: 'accounts' },
    ],
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'date' },
      { key: 'sellingLocation', label: 'Location', kind: 'text' },
      { key: 'financialAccount', label: 'Source account', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge', enum: 'expenseStatus' },
      money('amount', 'Amount'),
      { key: 'note', label: 'Description', kind: 'text' },
      { key: 'recordedBy', label: 'Recorded by', kind: 'actor' },
      { key: 'decidedBy', label: 'Decided by', kind: 'actor' },
    ],
    detail: null,
  },
  {
    type: 'cash',
    label: 'Cash Movement',
    locationScoped: true,
    kpis: [
      { key: 'cashIn', label: 'Cash in', kind: 'money' },
      { key: 'cashOut', label: 'Cash out', kind: 'money' },
      { key: 'movementCount', label: 'Movements', kind: 'count' },
    ],
    analytics: {
      breakdowns: [
        { key: 'primary', title: 'Cash in and out', measure: 'value', enum: 'cashMovementType' },
      ],
    },
    filters: [
      { key: 'cashMovementType', label: 'Direction', enum: 'cashMovementType' },
      { key: 'financialAccountId', label: 'Financial account', reference: 'accounts' },
    ],
    columns: [
      { key: 'occurredAt', label: 'Date', kind: 'datetime' },
      { key: 'sellingLocation', label: 'Location', kind: 'text' },
      { key: 'financialAccount', label: 'Financial account', kind: 'text' },
      { key: 'type', label: 'Direction', kind: 'enum', enum: 'cashMovementType' },
      money('amount', 'Amount'),
      { key: 'expenseLinked', label: 'From expense', kind: 'enum', enum: 'yesNo' },
      { key: 'note', label: 'Note', kind: 'text' },
      { key: 'recordedBy', label: 'Recorded by', kind: 'actor' },
    ],
    detail: null,
  },
  {
    type: 'tax',
    label: 'Tax Report',
    locationScoped: true,
    kpis: [
      { key: 'taxableBase', label: 'Taxable base', kind: 'money' },
      { key: 'taxAmount', label: 'Tax', kind: 'money' },
      { key: 'includedTax', label: 'Tax included in price', kind: 'money' },
      { key: 'excludedTax', label: 'Tax added to price', kind: 'money' },
    ],
    analytics: {
      trend: { title: 'Tax collected', kind: 'money' },
      breakdowns: [{ key: 'taxCode', title: 'Tax by tax code', measure: 'value' }],
      ranking: { title: 'Tax by item', kind: 'money' },
    },
    filters: [
      { key: 'catalogItemType', label: 'Item type', enum: 'itemType' },
      { key: 'categoryId', label: 'Category', reference: 'categories' },
      { key: 'catalogItemId', label: 'Item', reference: 'catalogItems' },
    ],
    columns: [
      { key: 'saleNumber', label: 'Transaction', kind: 'text', secondaryKey: 'invoiceNumber' },
      { key: 'itemName', label: 'Item', kind: 'text', secondaryKey: 'itemCode' },
      {
        key: 'taxCode',
        label: 'Tax',
        kind: 'text',
        secondaryKey: 'taxRate',
        secondaryKind: 'percent',
      },
      { key: 'taxTreatment', label: 'Treatment', kind: 'enum', enum: 'taxTreatment' },
      money('taxableBase', 'Taxable base'),
      money('taxAmount', 'Tax'),
    ],
    detail: 'tax',
  },
  {
    type: 'locations',
    label: 'Location Performance',
    locationScoped: true,
    kpis: [
      { key: 'finalRevenue', label: 'Revenue', kind: 'money' },
      { key: 'locationCount', label: 'Locations with sales', kind: 'count' },
    ],
    analytics: { ranking: { title: 'Revenue by location', kind: 'money' } },
    filters: [{ key: 'locationStatus', label: 'Location status', enum: 'recordStatus' }],
    columns: [
      { key: 'locationName', label: 'Location', kind: 'text', secondaryKey: 'locationCode' },
      count('transactionCount', 'Transactions'),
      money('finalRevenue', 'Revenue'),
      money('averageTransactionValue', 'Average transaction'),
      quantity('quantitySold', 'Items sold'),
      money('discountAmount', 'Discount'),
      money('taxAmount', 'Tax'),
    ],
    detail: null,
  },
];

export function reportDefinition(type: ReportType): ReportDefinition {
  return REPORT_CATALOG.find((definition) => definition.type === type) ?? REPORT_CATALOG[0]!;
}

export function isCatalogReport(value: string | null): value is ReportType {
  return REPORT_CATALOG.some((definition) => definition.type === value);
}
