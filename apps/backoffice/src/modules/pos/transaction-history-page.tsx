import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDateRangeFilter,
  DDialog,
  DSelectFilter,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useRuntime } from '@digvation/business-runtime';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { humanReadableLabel } from '../../app/localization/human-readable-labels';
import {
  TransactionHistoryApi,
  type FulfillmentStatus,
  type Payment,
  type PaymentStatus,
  type Sale,
  type SaleStatus,
} from './transaction-history-api';
import { transactionPaymentComposition } from './transaction-payment-composition';

const defaultPageSize = 20;

const transactionCopy = {
  id: {
    description: 'Lihat transaksi, pembayaran, dan status pengerjaan.',
    saleStatus: 'Status transaksi',
    payments: 'Pembayaran',
    workStatus: 'Status pengerjaan',
    work: 'Pengerjaan',
    search: 'Cari referensi pembayaran atau lokasi...',
    noPayments: 'Belum ada pembayaran.',
    noWork: 'Belum ada pengerjaan yang dicatat.',
    saleInformation: 'Informasi transaksi',
    paymentInformation: 'Informasi pembayaran',
    splitPayment: 'Split Payment',
    methods: 'metode',
    totalPaid: 'Total dibayar',
    balanceDue: 'Sisa tagihan',
    otherAttempts: 'Percobaan pembayaran lain',
    otherAttemptsNote: 'Tidak dihitung dalam pembayaran transaksi.',
    workInformation: 'Informasi pengerjaan',
    tendered: 'Uang diterima',
    change: 'Kembalian',
    invoice: 'Nomor faktur',
    currency: 'Mata uang',
    quantity: 'Jumlah',
  },
  en: {
    description: 'Review transactions, payments, and work status.',
    saleStatus: 'Transaction status',
    payments: 'Payments',
    workStatus: 'Work status',
    work: 'Work',
    search: 'Search payment reference or location...',
    noPayments: 'No payments recorded yet.',
    noWork: 'No work has been recorded yet.',
    saleInformation: 'Transaction information',
    paymentInformation: 'Payment information',
    splitPayment: 'Split Payment',
    methods: 'methods',
    totalPaid: 'Total paid',
    balanceDue: 'Balance due',
    otherAttempts: 'Other payment attempts',
    otherAttemptsNote: 'Not counted toward the transaction payment.',
    workInformation: 'Work information',
    tendered: 'Cash received',
    change: 'Change',
    invoice: 'Invoice number',
    currency: 'Currency',
    quantity: 'Quantity',
  },
} as const;

export function TransactionHistoryPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatDate, formatMoney, locale } = useBackofficeLocalization();
  const text = transactionCopy[locale];
  const api = useMemo(
    () => new TransactionHistoryApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [q, setQ] = useState('');
  const [saleStatus, setSaleStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: [
      'transaction-history',
      offset,
      pageSize,
      q,
      saleStatus,
      paymentStatus,
      fulfillmentStatus,
      createdFrom,
      createdTo,
    ],
    queryFn: () =>
      api.list({
        limit: pageSize,
        offset,
        q,
        saleStatus,
        paymentStatus,
        fulfillmentStatus,
        createdFrom,
        createdTo,
      }),
  });
  const detail = useQuery({
    queryKey: ['transaction-history-detail', detailId],
    queryFn: () => api.get(detailId!),
    enabled: Boolean(detailId),
  });
  if (list.isError)
    return (
      <DConnectionError
        title={copy('Could not load transaction history.')}
        message={copy('Try loading transaction history again.')}
        onRetry={() => void list.refetch()}
      />
    );
  const columns: TableColumn<Sale>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (row) =>
        formatDate(new Date(row.createdAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'sale',
      label: copy('Transaction number'),
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold">{row.saleNumber}</p>
          {row.invoiceNumber ? (
            <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
              {row.invoiceNumber}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      label: copy('Total'),
      render: (row) => formatMoney(row.totalAmount, row.currency),
    },
    {
      key: 'saleStatus',
      label: text.saleStatus,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'payments',
      label: text.payments,
      render: (row) =>
        row.payments.length ? (
          <div className="flex flex-wrap gap-1">
            {row.payments.map((payment) => (
              <StatusBadge key={payment.id} status={payment.status} />
            ))}
          </div>
        ) : (
          '-'
        ),
    },
    {
      key: 'fulfillment',
      label: text.work,
      render: (row) => <FulfillmentSummary lines={row.lines} />,
    },
  ];
  const resetPage = () => setOffset(0);
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Reporting')}
        title={copy('Transaction history')}
        description={text.description}
      />
      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          searchable
          searchPlaceholder={text.search}
          searchValue={q}
          onSearchChange={(value) => {
            setQ(value);
            resetPage();
          }}
          filters={
            <div className="flex flex-wrap gap-2">
              <DSelectFilter
                label={text.saleStatus}
                value={saleStatus || null}
                clearable
                onChange={(value) => {
                  setSaleStatus(String(value ?? ''));
                  resetPage();
                }}
                options={saleStatuses.map((value) => ({
                  value,
                  label: humanReadableLabel(value, locale),
                }))}
              />
              <DSelectFilter
                label={copy('Payment status')}
                value={paymentStatus || null}
                clearable
                onChange={(value) => {
                  setPaymentStatus(String(value ?? ''));
                  resetPage();
                }}
                options={paymentStatuses.map((value) => ({
                  value,
                  label: humanReadableLabel(value, locale),
                }))}
              />
              <DSelectFilter
                label={text.workStatus}
                value={fulfillmentStatus || null}
                clearable
                onChange={(value) => {
                  setFulfillmentStatus(String(value ?? ''));
                  resetPage();
                }}
                options={fulfillmentStatuses.map((value) => ({
                  value,
                  label: humanReadableLabel(value, locale),
                }))}
              />
              <DDateRangeFilter
                from={createdFrom}
                to={createdTo}
                onFromChange={(value) => {
                  setCreatedFrom(value);
                  resetPage();
                }}
                onToChange={(value) => {
                  setCreatedTo(value);
                  resetPage();
                }}
                onClear={() => {
                  setCreatedFrom('');
                  setCreatedTo('');
                  resetPage();
                }}
              />
            </div>
          }
          actions={[
            {
              label: copy('View transaction'),
              icon: <Eye aria-hidden="true" className="size-4" />,
              onClick: (row) => setDetailId(row.id),
            },
          ]}
          pagination={{
            page: Math.floor(offset / pageSize) + 1,
            pageSize,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetPage();
          }}
          emptyMessage={copy('No transactions match the current filters.')}
        />
      </section>
      <TransactionDetail
        open={Boolean(detailId)}
        item={detail.data}
        loading={detail.isLoading}
        error={detail.isError}
        onClose={() => setDetailId(null)}
      />
    </BackofficePage>
  );
}

const saleStatuses: SaleStatus[] = ['OPEN', 'FINALIZED', 'VOIDED'];
const paymentStatuses: PaymentStatus[] = ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const fulfillmentStatuses: FulfillmentStatus[] = [
  'WAITING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELED',
];

function StatusBadge({ status }: { status: SaleStatus | PaymentStatus | FulfillmentStatus }) {
  const { locale } = useBackofficeLocalization();
  const variant = ['FINALIZED', 'SUCCEEDED', 'COMPLETED'].includes(status)
    ? 'success'
    : ['VOIDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'CANCELED'].includes(status)
      ? 'secondary'
      : status === 'PENDING' || status === 'IN_PROGRESS'
        ? 'warning'
        : 'outline';
  return <DBadge variant={variant}>{humanReadableLabel(status, locale)}</DBadge>;
}

function FulfillmentSummary({ lines }: { lines: Sale['lines'] }) {
  const tracked = lines.filter((line) => line.fulfillment);
  return tracked.length ? (
    <div className="flex flex-wrap gap-1">
      {tracked.map((line) => (
        <StatusBadge key={line.id} status={line.fulfillment!.status} />
      ))}
    </div>
  ) : (
    '-'
  );
}

function TransactionDetail({
  open,
  item,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  item: Sale | undefined;
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  const { copy, formatDate, formatMoney, locale } = useBackofficeLocalization();
  const text = transactionCopy[locale];
  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="xl"
      title={copy('Transaction details')}
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {copy('Loading transaction details...')}
        </p>
      ) : error || !item ? (
        <DConnectionError
          title={copy('Could not load transaction details.')}
          message={copy('Close this dialog and try again.')}
          onRetry={onClose}
        />
      ) : (
        <div>
          <section className="border-b border-[var(--color-border)] pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="break-words font-mono text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {item.saleNumber}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {item.invoiceNumber ? `${text.invoice}: ${item.invoiceNumber}, ` : ''}
                  {formatDate(new Date(item.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {copy('Total')}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                {formatMoney(item.totalAmount, item.currency)}
              </p>
            </div>
          </section>

          <section className="border-b border-[var(--color-border)] py-5">
            <h3 className="text-base font-semibold">{text.saleInformation}</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                label={copy('Discount')}
                value={formatMoney(item.discountAmount, item.currency)}
              />
              <Fact label={copy('Tax')} value={formatMoney(item.taxAmount, item.currency)} />
              <Fact
                label={copy('Total')}
                value={formatMoney(item.totalAmount, item.currency)}
                emphasized
              />
              <Fact label={text.currency} value={item.currency} />
            </dl>
          </section>

          <TransactionPayments item={item} />

          <section className="pt-5">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">{text.workInformation}</h3>
              <DBadge variant="secondary">
                {item.lines.filter((line) => line.fulfillment).length}
              </DBadge>
            </div>
            {item.lines.filter((line) => line.fulfillment).length ? (
              <div className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
                {item.lines
                  .filter((line) => line.fulfillment)
                  .map((line) => (
                    <div key={line.id} className="flex items-start justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text)]">
                          {line.itemNameSnapshot}
                        </p>
                        {line.variantNameSnapshot ? (
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {line.variantNameSnapshot}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {text.quantity}: {line.quantity}
                        </p>
                      </div>
                      <StatusBadge status={line.fulfillment!.status} />
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-text-muted)]">{text.noWork}</p>
            )}
          </section>
        </div>
      )}
    </DDialog>
  );
}

/**
 * How the transaction was actually paid. Only succeeded payments settle a sale, so a failed or
 * cancelled attempt never turns a single payment into a split one; attempts stay listed apart.
 */
function TransactionPayments({ item }: { item: Sale }) {
  const { formatMoney, locale } = useBackofficeLocalization();
  const text = transactionCopy[locale];
  const composition = transactionPaymentComposition(item);
  const accountName = (payment: Payment) =>
    payment.financeFinancialAccountNameSnapshot?.trim() ||
    humanReadableLabel(payment.method, locale);
  return (
    <section className="border-b border-[var(--color-border)] py-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{text.paymentInformation}</h3>
        {composition.isSplit ? (
          <DBadge variant="info">
            {text.splitPayment} · {composition.applied.length} {text.methods}
          </DBadge>
        ) : null}
      </div>
      {composition.applied.length ? (
        <dl className="mt-4 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {composition.applied.map((payment) => {
            const name = accountName(payment);
            const method = humanReadableLabel(payment.method, locale);
            const detail = [
              name === method ? null : method,
              payment.providerReference,
              payment.tenderedAmount
                ? `${text.tendered}: ${formatMoney(payment.tenderedAmount, payment.currency)}`
                : null,
              payment.changeAmount && /[1-9]/.test(payment.changeAmount)
                ? `${text.change}: ${formatMoney(payment.changeAmount, payment.currency)}`
                : null,
            ].filter(Boolean);
            return (
              <div key={payment.id} className="flex items-start justify-between gap-4 py-3">
                <dt className="min-w-0">
                  <span className="block break-words font-medium text-[var(--color-text)]">
                    {name}
                  </span>
                  {detail.length ? (
                    <span className="mt-0.5 block break-words text-xs text-[var(--color-text-muted)]">
                      {detail.join(' · ')}
                    </span>
                  ) : null}
                </dt>
                <dd className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">
                  {formatMoney(payment.appliedAmount, payment.currency)}
                </dd>
              </div>
            );
          })}
          {composition.isSplit || !composition.settled ? (
            <div className="flex items-baseline justify-between gap-4 py-3 text-sm font-semibold">
              <dt>{text.totalPaid}</dt>
              <dd className="tabular-nums">{formatMoney(composition.totalPaid, item.currency)}</dd>
            </div>
          ) : null}
          {composition.balanceDue !== '0.0000' ? (
            <div className="flex items-baseline justify-between gap-4 py-3 text-sm font-semibold text-[var(--color-warning)]">
              <dt>{text.balanceDue}</dt>
              <dd className="tabular-nums">{formatMoney(composition.balanceDue, item.currency)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">{text.noPayments}</p>
      )}
      {composition.notApplied.length ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {text.otherAttempts}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{text.otherAttemptsNote}</p>
          <ul className="mt-2 divide-y divide-[var(--color-border)]">
            {composition.notApplied.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-4 py-2 text-sm text-[var(--color-text-muted)]"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-words">{accountName(payment)}</span>
                  <StatusBadge status={payment.status} />
                </span>
                <span className="shrink-0 tabular-nums line-through">
                  {formatMoney(payment.appliedAmount, payment.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Fact({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[var(--color-text)] ${
          emphasized ? 'text-base font-semibold' : 'text-sm font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
