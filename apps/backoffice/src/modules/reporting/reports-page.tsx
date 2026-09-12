import { useRuntime } from '@digvation/business-runtime';
import {
  DButton,
  DDataTable,
  DDateRangeFilter,
  DDropdown,
  DInput,
  DSelect,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  Filter,
  Hash,
  PackageCheck,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  AnalyticsDonutChart,
  AnalyticsHorizontalBarChart,
  AnalyticsLineChart,
  type AnalyticsPoint,
} from '../../components/analytics/analytics-charts';
import { AnalyticsKpiCard } from '../../components/analytics/analytics-kpi-card';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';

const types = [
  ['business-performance', 'Business Performance Summary'],
  ['transactions', 'Transaction Report'],
  ['catalog-performance', 'Catalog Performance'],
  ['employee-performance', 'Employee Performance'],
  ['attendance', 'Attendance Report'],
  ['payments', 'Payment Report'],
  ['expenses', 'Expense Report'],
  ['cash', 'Cash Report'],
  ['settlements', 'Settlement Report'],
  ['reconciliations', 'Reconciliation Report'],
  ['tax', 'Tax Report'],
  ['locations', 'Selling Location Performance'],
] as const;
type Type = (typeof types)[number][0];
type Row = Record<string, string | number | null>;
type Option = { id: string; name?: string; displayName?: string; code: string };
type Page<T> = { items: T[] };
type OperationalAccess = {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
  locations: Option[];
};
type Dataset = {
  summary: Row;
  analytics: {
    trend: AnalyticsPoint[];
    breakdown: AnalyticsPoint[];
    breakdowns?: Record<string, AnalyticsPoint[]>;
    ranking: AnalyticsPoint[];
  };
  items: Row[];
  total: number;
};
const details: Record<Type, string[]> = {
  'business-performance': [],
  transactions: [
    'saleNumber',
    'invoiceNumber',
    'occurredAt',
    'sellingLocation',
    'saleStatus',
    'gross',
    'discount',
    'tax',
    'total',
    'paymentAttempts',
    'paymentStatuses',
    'fulfillmentStatuses',
  ],
  'catalog-performance': [
    'rank',
    'itemCode',
    'itemName',
    'transactionCount',
    'quantitySold',
    'grossRevenue',
    'discountAmount',
    'taxAmount',
    'finalRevenue',
    'averageSellingValue',
    'sellingLocationCount',
  ],
  'employee-performance': [
    'rank',
    'employeeCode',
    'employeeName',
    'contributedTransactions',
    'contributedLineItems',
    'contributionRevenue',
    'averageContributionPerTransaction',
    'topCatalogItem',
  ],
  attendance: [
    'attendanceDate',
    'employeeCode',
    'employeeName',
    'position',
    'status',
    'checkIn',
    'checkOut',
    'source',
    'note',
  ],
  payments: [
    'saleNumber',
    'invoiceNumber',
    'occurredAt',
    'sellingLocation',
    'method',
    'status',
    'currency',
    'appliedAmount',
    'tenderedAmount',
    'changeAmount',
    'providerReference',
  ],
  expenses: [
    'occurredAt',
    'sellingLocation',
    'financialAccount',
    'origin',
    'status',
    'currency',
    'amount',
    'note',
    'approvedAt',
    'rejectedAt',
  ],
  cash: [
    'occurredAt',
    'sellingLocation',
    'financialAccount',
    'type',
    'currency',
    'amount',
    'expenseLinked',
    'note',
  ],
  settlements: [
    'settlementId',
    'sellingLocation',
    'financialAccount',
    'paymentMethod',
    'currency',
    'expectedAmount',
    'status',
    'includedPaymentCount',
    'createdAt',
    'completedAt',
  ],
  reconciliations: [
    'settlementId',
    'sellingLocation',
    'financialAccount',
    'expectedAmount',
    'actualAmount',
    'difference',
    'status',
    'createdAt',
  ],
  tax: [
    'saleNumber',
    'invoiceNumber',
    'sellingLocation',
    'itemCode',
    'itemName',
    'taxCode',
    'taxRate',
    'taxTreatment',
    'taxableBase',
    'taxAmount',
    'includedTax',
    'excludedTax',
  ],
  locations: [
    'locationCode',
    'locationName',
    'transactionCount',
    'finalRevenue',
    'averageTransactionValue',
    'quantitySold',
    'discountAmount',
    'taxAmount',
  ],
};

const permissionByType: Record<Type, string> = {
  'business-performance': 'sales:read',
  transactions: 'sales:read',
  'catalog-performance': 'catalog:read',
  'employee-performance': 'employees:read',
  attendance: 'attendance:read',
  payments: 'payments:read',
  expenses: 'expenses:read',
  cash: 'cash:read',
  settlements: 'settlements:read',
  reconciliations: 'reconciliations:read',
  tax: 'tax:read',
  locations: 'locations:read',
};

function reportTypeIsAvailable(
  type: Type,
  permissions: readonly string[],
  products: readonly string[],
  capabilities: readonly string[],
) {
  if (!permissions.includes(permissionByType[type])) return false;
  if (
    ['business-performance', 'transactions', 'payments'].includes(type) &&
    !products.includes('POS')
  )
    return false;
  if (
    ['expenses', 'cash', 'settlements', 'reconciliations'].includes(type) &&
    !capabilities.includes('FINANCE_OPERATIONS')
  )
    return false;
  if (
    type === 'attendance' &&
    !capabilities.includes('WORKFORCE_ATTENDANCE')
  )
    return false;
  return true;
}
const metrics: Record<Type, string[]> = {
  'business-performance': [
    'finalRevenue',
    'transactionCount',
    'averageTransactionValue',
    'quantitySold',
  ],
  transactions: [
    'transactionCount',
    'finalRevenue',
    'averageTransactionValue',
    'successfulPaymentAmount',
  ],
  'catalog-performance': ['finalRevenue', 'quantitySold', 'itemCount', 'averageSellingValue'],
  'employee-performance': [
    'contributionRevenue',
    'employeeCount',
    'contributedTransactions',
    'averageContribution',
  ],
  attendance: ['totalRecords', 'employeeCount', 'presentCount', 'absentCount'],
  payments: ['successfulAmount', 'attemptCount', 'successfulPayments', 'failedPayments'],
  expenses: ['approvedExpenseTotal', 'expenseCount', 'pendingCount', 'rejectedCount'],
  cash: ['cashIn', 'cashOut', 'netMovement', 'movementCount'],
  settlements: ['expectedAmount', 'settlementCount', 'completedCount', 'draftCount'],
  reconciliations: ['reconciliationCount', 'matchedCount', 'discrepancyCount', 'differenceAmount'],
  tax: ['taxAmount', 'taxableBase', 'includedTax', 'excludedTax'],
  locations: ['finalRevenue', 'transactionCount', 'averageTransactionValue', 'quantitySold'],
};
const visuals: Record<Type, { trend: string; insights: [string, string][]; ranking?: string }> = {
  'business-performance': {
    trend: 'Revenue activity',
    insights: [['paymentMethod', 'Payment mix']],
    ranking: 'Location performance',
  },
  transactions: {
    trend: 'Transaction activity',
    insights: [
      ['saleStatus', 'Sale status'],
      ['paymentMethod', 'Payment method mix'],
    ],
  },
  'catalog-performance': {
    trend: 'Catalog activity',
    insights: [['primary', 'Catalog mix']],
    ranking: 'Top catalog items',
  },
  'employee-performance': {
    trend: 'Contribution activity',
    insights: [['primary', 'Contribution mix']],
    ranking: 'Top contributors',
  },
  attendance: {
    trend: 'Attendance activity',
    insights: [['primary', 'Attendance status']],
  },
  payments: { trend: 'Payment activity', insights: [['primary', 'Payment status insight']] },
  expenses: { trend: 'Expense activity', insights: [['primary', 'Expense status']] },
  cash: { trend: 'Cash movement activity', insights: [['primary', 'Cash movement mix']] },
  settlements: { trend: 'Settlement activity', insights: [['primary', 'Settlement status']] },
  reconciliations: {
    trend: 'Reconciliation activity',
    insights: [['primary', 'Reconciliation status']],
  },
  tax: { trend: 'Tax activity', insights: [['primary', 'Tax contribution']] },
  locations: {
    trend: 'Location revenue comparison',
    insights: [['primary', 'Revenue share']],
    ranking: 'Location ranking',
  },
};
const filterFields: Record<Type, [string, string, string[]][]> = {
  'business-performance': [['saleStatus', 'Sale status', ['OPEN', 'FINALIZED', 'VOIDED']]],
  transactions: [
    ['saleStatus', 'Sale status', ['OPEN', 'FINALIZED', 'VOIDED']],
    ['paymentStatus', 'Payment status', ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']],
    ['paymentMethod', 'Payment method', ['CASH', 'BANK_TRANSFER', 'WALLET', 'QRIS']],
    [
      'fulfillmentStatus',
      'Fulfillment status',
      ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'],
    ],
  ],
  'catalog-performance': [
    ['catalogItemType', 'Item type', ['PRODUCT', 'SERVICE']],
    ['catalogLifecycle', 'Catalog lifecycle', ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']],
  ],
  'employee-performance': [['employeeStatus', 'Employee status', ['ACTIVE', 'INACTIVE']]],
  attendance: [
    ['attendanceStatus', 'Attendance status', ['PRESENT', 'ABSENT', 'LEAVE', 'SICK']],
    ['attendanceSource', 'Source', ['LOCAL', 'HRIS']],
  ],
  payments: [
    ['paymentStatus', 'Payment status', ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED']],
    ['paymentMethod', 'Payment method', ['CASH', 'BANK_TRANSFER', 'WALLET', 'QRIS']],
  ],
  expenses: [
    ['status', 'Status', ['PENDING', 'APPROVED', 'REJECTED']],
    ['origin', 'Origin', ['BACKOFFICE', 'CASHIER']],
  ],
  cash: [['cashMovementType', 'Movement type', ['CASH_IN', 'CASH_OUT']]],
  settlements: [
    ['status', 'Status', ['DRAFT', 'COMPLETED', 'CANCELLED']],
    ['paymentMethod', 'Payment method', ['CASH', 'BANK_TRANSFER', 'WALLET', 'QRIS']],
  ],
  reconciliations: [['status', 'Status', ['MATCHED', 'DISCREPANCY', 'RESOLVED']]],
  tax: [],
  locations: [['locationStatus', 'Location status', ['ACTIVE', 'INACTIVE']]],
};
const title = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const money = (k: string) =>
  /amount|revenue|gross|discount|tax|cash|difference|base|value/i.test(k) && !/count|rate/i.test(k);
const count = (k: string) => /count|attempts|items|transactions|records/i.test(k);
const quantity = (k: string) => /quantity/i.test(k);
const dateKey = /^\d{4}-\d{2}-\d{2}$/;
const attendanceLabels: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  SICK: 'Sick',
  LOCAL: 'Local',
  HRIS: 'HRIS',
};
function requestedType(value: string | null): Type {
  return types.some(([candidate]) => candidate === value)
    ? (value as Type)
    : 'business-performance';
}
function initialReportState(today: string) {
  if (typeof window === 'undefined') {
    return {
      from: today,
      to: today,
      type: 'business-performance' as Type,
      locationId: '',
    };
  }
  const search = new URLSearchParams(window.location.search);
  const from = search.get('dateFrom');
  const to = search.get('dateTo');
  return {
    from: from && dateKey.test(from) ? from : today,
    to: to && dateKey.test(to) ? to : today,
    type: requestedType(search.get('type')),
    locationId: search.get('sellingLocationId') ?? '',
  };
}
function MetricIcon({ metric }: { metric: string }) {
  const Icon = money(metric)
    ? CircleDollarSign
    : quantity(metric)
      ? PackageCheck
      : count(metric)
        ? Hash
        : ChartNoAxesColumnIncreasing;
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

export function ReportsPage() {
  const { createApiClient, getAccessToken, session } = useBackofficeAuth();
  const runtime = useRuntime();
  const { apiBaseUrl } = runtime;
  const { copy, formatDate, formatMoney } = useBackofficeLocalization();
  const api = useMemo(() => createApiClient(apiBaseUrl), [apiBaseUrl, createApiClient]);
  const availableTypes = useMemo(
    () =>
      types.filter(([candidate]) =>
        reportTypeIsAvailable(
          candidate,
          session?.identity.permissions ?? [],
          session?.effectiveEntitlements.products ?? [],
          session?.effectiveEntitlements.capabilities ?? [],
        ),
      ),
    [session?.effectiveEntitlements, session?.identity.permissions],
  );
  const today = new Date().toISOString().slice(0, 10);
  const initial = useMemo(() => initialReportState(today), [today]);
  const [from, setFrom] = useState(initial.from),
    [to, setTo] = useState(initial.to),
    [selectedType, setType] = useState<Type>(initial.type),
    [selectedLocationId, setLocationId] = useState(initial.locationId),
    [filters, setFilters] = useState<Record<string, string>>({}),
    [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(25);
  const type = availableTypes.some(([candidate]) => candidate === selectedType)
    ? selectedType
    : (availableTypes[0]?.[0] ?? 'business-performance');
  const locationScoped = type !== 'attendance';
  const locations = useQuery({
    queryKey: ['operational-location-context'],
    queryFn: () => api.get<OperationalAccess>('/api/v1/operational-access/context'),
    enabled: locationScoped,
  });
  const requestedLocationIsAvailable = Boolean(
    selectedLocationId &&
      locations.data?.locations.some((location) => location.id === selectedLocationId),
  );
  const locationId =
    (requestedLocationIsAvailable ? selectedLocationId : '') ||
    (locations.data?.resolution === 'AUTO_RESOLVED'
      ? (locations.data.selectedLocationId ?? '')
      : '');
  const categories = useQuery({
    queryKey: ['report-categories'],
    queryFn: () => api.get<Page<Option>>('/api/v1/catalog/categories?limit=100&offset=0'),
    enabled: Boolean(
      session?.identity.permissions.some((permission) =>
        ['catalog:read', 'tax:read'].includes(permission),
      ),
    ),
  });
  const catalog = useQuery({
    queryKey: ['report-catalog'],
    queryFn: () => api.get<Page<Option>>('/api/v1/catalog/items?limit=100&offset=0'),
    enabled: Boolean(
      session?.identity.permissions.some((permission) =>
        ['catalog:read', 'tax:read'].includes(permission),
      ),
    ),
  });
  const employees = useQuery({
    queryKey: ['report-employees'],
    queryFn: () => api.get<Page<Option>>('/api/v1/employees?limit=100&offset=0'),
    enabled: Boolean(session?.identity.permissions.includes('employees:read')),
  });
  const positions = useQuery({
    queryKey: ['report-employee-positions'],
    queryFn: () => api.get<Page<Option>>('/api/v1/employees/positions?limit=100&offset=0'),
    enabled: Boolean(session?.identity.permissions.includes('employees:read')),
  });
  const accounts = useQuery({
    queryKey: ['report-accounts'],
    queryFn: () => api.get<Page<Option>>('/api/v1/financial-accounts?limit=100&offset=0'),
    enabled: Boolean(
      session?.effectiveEntitlements.capabilities.includes('FINANCE_OPERATIONS') &&
      session?.identity.permissions.includes('financial-accounts:read'),
    ),
  });
  const locationSelectionReady =
    !locationScoped ||
    locations.data?.resolution !== 'SELECTION_REQUIRED' ||
    Boolean(locationId);
  const params = new URLSearchParams({
    dateFrom: from,
    dateTo: to,
    page: String(page),
    pageSize: String(pageSize),
    ...(locationScoped && locationId ? { sellingLocationId: locationId } : {}),
    ...filters,
  }).toString();
  const query = useQuery({
    queryKey: ['reports', type, params],
    enabled: locationSelectionReady && availableTypes.some(([candidate]) => candidate === type),
    queryFn: () => api.get<Dataset>(`/api/v1/reports/${type}?${params}`),
  });
  const data = query.data;
  const integer = (v: number) => new Intl.NumberFormat('id-ID').format(v);
  const format = useCallback(
    (k: string, v: Row[string] | undefined) => {
      if (type === 'attendance') {
        if (k === 'attendanceDate' && v)
          return formatDate(new Date(`${String(v).slice(0, 10)}T00:00:00`));
        if (['checkIn', 'checkOut'].includes(k))
          return v ? formatDate(new Date(String(v)), { timeStyle: 'short' }) : '—';
        const attendanceLabel = attendanceLabels[String(v ?? '')];
        if (attendanceLabel) return copy(attendanceLabel);
      }
      return money(k)
        ? formatMoney(String(v ?? 0), 'IDR')
        : count(k)
          ? integer(Number(v ?? 0))
          : quantity(k)
            ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(Number(v ?? 0))
            : copy(String(v ?? '—'));
    },
    [copy, formatDate, formatMoney, type],
  );
  const columns = useMemo<TableColumn<Row>[]>(
    () =>
      details[type]
        .filter((k) => data?.items.some((r) => k in r))
        .map((k) => ({ key: k, label: copy(title(k)), render: (r) => format(k, r[k]) })),
    [copy, data?.items, format, type],
  );
  const update = (k: string, v: string) => {
    setFilters((c) => {
      const n = { ...c };
      if (v) n[k] = v;
      else delete n[k];
      return n;
    });
    setPage(1);
  };
  const activeCount = Object.keys(filters).length;
  const option = (r: Option) => r.name ?? r.displayName ?? r.code;
  const choices = (fields: [string, string, string[]][]) =>
    fields.map(
      ([k, l, values]) =>
        [
          k,
          l,
          [
            { value: '', label: copy('All') },
            ...values.map((value) => ({
              value,
              label: copy(attendanceLabels[value] ?? value),
            })),
          ],
        ] as [string, string, { value: string; label: string }[]],
    );
  const optionFilters: Record<Type, [string, string, { value: string; label: string }[]][]> = {
    ...(Object.fromEntries(Object.entries(filterFields).map(([r, f]) => [r, choices(f)])) as Record<
      Type,
      [string, string, { value: string; label: string }[]][]
    >),
    'catalog-performance': [
      ...choices(filterFields['catalog-performance']),
      [
        'categoryId',
        'Category',
        [
          { value: '', label: copy('All') },
          ...(categories.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
      [
        'catalogItemId',
        'Item',
        [
          { value: '', label: copy('All') },
          ...(catalog.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    'employee-performance': [
      ...choices(filterFields['employee-performance']),
      [
        'employeeId',
        'Employee',
        [
          { value: '', label: copy('All') },
          ...(employees.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    attendance: [
      ...choices(filterFields.attendance),
      [
        'employeeId',
        'Employee',
        [
          { value: '', label: copy('All') },
          ...(employees.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
      [
        'positionId',
        'Position',
        [
          { value: '', label: copy('All') },
          ...(positions.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    expenses: [
      ...choices(filterFields.expenses),
      [
        'financialAccountId',
        'Financial Account',
        [
          { value: '', label: copy('All') },
          ...(accounts.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    cash: [
      ...choices(filterFields.cash),
      [
        'financialAccountId',
        'Financial Account',
        [
          { value: '', label: copy('All') },
          ...(accounts.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    settlements: [
      ...choices(filterFields.settlements),
      [
        'financialAccountId',
        'Financial Account',
        [
          { value: '', label: copy('All') },
          ...(accounts.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    reconciliations: [
      ...choices(filterFields.reconciliations),
      [
        'financialAccountId',
        'Financial Account',
        [
          { value: '', label: copy('All') },
          ...(accounts.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
    ],
    tax: [
      [
        'categoryId',
        'Category',
        [
          { value: '', label: copy('All') },
          ...(categories.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
      [
        'catalogItemId',
        'Item',
        [
          { value: '', label: copy('All') },
          ...(catalog.data?.items ?? []).map((i) => ({ value: i.id, label: option(i) })),
        ],
      ],
      [
        'catalogItemType',
        'Item type',
        [
          { value: '', label: copy('All') },
          { value: 'PRODUCT', label: copy('PRODUCT') },
          { value: 'SERVICE', label: copy('SERVICE') },
        ],
      ],
    ],
  };
  const download = async (kind: 'xlsx' | 'pdf' | 'csv') => {
    const token = await getAccessToken();
    const p = new URLSearchParams({
      dateFrom: from,
      dateTo: to,
      ...(locationScoped && locationId ? { sellingLocationId: locationId } : {}),
      ...filters,
    });
    const response = await fetch(`${apiBaseUrl}/api/v1/reports/${type}/export.${kind}?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${from}_${to}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const visual = visuals[type],
    empty = copy('No analytics data is available for this period.'),
    localized = (k: string) =>
      (
        data?.analytics.breakdowns?.[k] ??
        (k === 'primary' ? data?.analytics.breakdown : []) ??
        []
      ).map((p) => ({
        ...p,
        label: copy(attendanceLabels[p.label] ?? p.label),
      }));
  const activeFilters = Object.entries(filters).map(([k, v]) => ({
    key: k,
    label: `${copy(title(k))}: ${copy(attendanceLabels[v] ?? v)}`,
  }));
  const exportMenu = (
    <DDropdown
      placement="bottom-end"
      contentRole="menu"
      closeOnItemClick
      trigger={() => <DButton>{copy('Export')}</DButton>}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
        onClick={() => void download('xlsx')}
      >
        {copy('Export Excel')}
      </button>
      {type === 'attendance' ? (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
          onClick={() => void download('csv')}
        >
          {copy('Export CSV')}
        </button>
      ) : (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
          onClick={() => void download('pdf')}
        >
          {copy('Export PDF')}
        </button>
      )}
    </DDropdown>
  );
  return (
    <BackofficePage>
      <div className="pt-2">
        <BackofficePageHeader
          eyebrow={copy('Reporting')}
          title={copy(availableTypes.find(([candidate]) => candidate === type)?.[1] ?? 'Reports')}
          description={copy(
            'Reports compose authoritative projections from the available business domains.',
          )}
          actions={exportMenu}
        />
      </div>
      <div
        className={`mt-4 grid grid-cols-1 items-end gap-3 md:gap-3 ${
          locationScoped
            ? 'md:grid-cols-[300px_360px_240px_auto]'
            : 'md:grid-cols-[300px_360px_auto]'
        }`}
      >
        <div className="min-w-0">
          <DSelect
            label={copy('Report type')}
            value={type}
            options={availableTypes.map(([value, label]) => ({
              value,
              label: copy(label),
            }))}
            onChange={(v) => {
              setType(v as Type);
              setFilters({});
              setPage(1);
            }}
          />
        </div>
        <div className="min-w-0">
          <DDateRangeFilter
            from={from}
            to={to}
            onFromChange={(v) => {
              setFrom(v);
              setPage(1);
            }}
            onToChange={(v) => {
              setTo(v);
              setPage(1);
            }}
          />
        </div>
        {locationScoped ? (
          <div className="min-w-0">
            <DSelect
              label={copy('Location')}
              value={locationId}
              options={[
                {
                  value: '',
                  label: copy(locations.data?.organizationWide ? 'All locations' : 'Select location'),
                },
                ...(locations.data?.locations ?? []).map((i) => ({
                  value: i.id,
                  label: option(i),
                })),
              ]}
              onChange={(v) => {
                setLocationId(String(v ?? ''));
                setPage(1);
              }}
            />
          </div>
        ) : null}
        <div className="min-w-0">
          <DDropdown
            placement="bottom-start"
            contentRole="dialog"
            trigger={() => (
              <DButton variant="secondary">
                <Filter aria-hidden="true" className="mr-2 size-4" />
                {copy('Filters')}
                {activeCount ? ` (${activeCount})` : ''}
              </DButton>
            )}
          >
            <div className="w-[320px] space-y-3 p-3">
              {type === 'transactions' ? (
                <DInput
                  label={copy('Search transaction or invoice number')}
                  value={filters.search ?? ''}
                  onChange={(v) => update('search', v)}
                />
              ) : null}
              {type === 'attendance' ? (
                <DInput
                  label={copy('Search employee code or name')}
                  value={filters.search ?? ''}
                  onChange={(v) => update('search', v)}
                />
              ) : null}
              {type === 'tax' ? (
                <DInput
                  label={copy('Tax code')}
                  value={filters.taxCode ?? ''}
                  onChange={(v) => update('taxCode', v)}
                />
              ) : null}
              {optionFilters[type].map(([k, l, o]) => (
                <DSelect
                  key={k}
                  label={copy(l)}
                  value={filters[k] ?? ''}
                  options={o}
                  onChange={(v) => update(k, String(v ?? ''))}
                />
              ))}
              {activeCount ? (
                <DButton
                  variant="secondary"
                  onClick={() => {
                    setFilters({});
                    setPage(1);
                  }}
                >
                  {copy('Clear filters')}
                </DButton>
              ) : null}
            </div>
          </DDropdown>
        </div>
      </div>
      {activeFilters.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {activeFilters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => update(key, '')}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 text-xs text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              <span>{label}</span>
              <span aria-hidden="true" className="text-sm leading-none">
                ×
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
            className="h-7 px-1 text-xs font-medium text-[var(--color-brand)]"
          >
            {copy('Clear filters')}
          </button>
        </div>
      ) : null}
      <section className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {metrics[type]
          .filter((k) => k in (data?.summary ?? {}))
          .map((k) => (
            <AnalyticsKpiCard
              key={k}
              label={copy(title(k))}
              value={format(k, data?.summary[k])}
              icon={<MetricIcon metric={k} />}
            />
          ))}
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <AnalyticsLineChart
          title={copy(visual.trend)}
          subtitle={`${copy('Selected period')}: ${from} — ${to}`}
          data={data?.analytics.trend ?? []}
          formatValue={(v) =>
            type === 'attendance' ? integer(Number(v)) : formatMoney(v, 'IDR')
          }
          emptyMessage={empty}
          pointsLabel={copy('data points')}
        />
        {visual.insights.length ? (
          <div className="grid content-start gap-4">
            {visual.insights.map(([k, l]) => {
              const points = localized(k);
              return points.length ? (
                <AnalyticsDonutChart
                  key={k}
                  title={copy(l)}
                  data={points}
                  emptyMessage={empty}
                  totalLabel={copy('Total')}
                  formatValue={integer}
                />
              ) : null;
            })}
          </div>
        ) : null}
      </section>
      {visual.ranking && data?.analytics.ranking.length ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <AnalyticsHorizontalBarChart
            title={copy(visual.ranking)}
            data={data.analytics.ranking}
            formatValue={(v) => formatMoney(v, 'IDR')}
            emptyMessage={empty}
          />
        </section>
      ) : null}
      {details[type].length ? (
        <section className="mt-6">
          <div className="mb-3">
            <h2 className="text-sm font-semibold tracking-tight">{copy('Detailed records')}</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Operational detail for the selected report and date range.')}
            </p>
          </div>
          <DDataTable
            rowKey={(row, index) => String(row.id ?? index)}
            loading={query.isLoading}
            data={data?.items ?? []}
            columns={columns}
            emptyMessage={copy('No report data is available for this period.')}
            pagination={{ page, pageSize, total: data?.total ?? 0 }}
            onPageChange={setPage}
            onPageSizeChange={(v) => {
              setPageSize(v);
              setPage(1);
            }}
          />
        </section>
      ) : null}
    </BackofficePage>
  );
}
