import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { createDecimal } from '@digvation/pos-money';
import { DSkeleton } from '@digvation-labs/ui';
import {
  DBadge,
  DConnectionError,
  DDataTable,
  DDialog,
  DRangeDatePicker,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import {
  employeeDisplayName,
  lineDiscountPercentage,
  saleDiscountRows,
  saleTaxLabel,
} from '../../features/sell/sale-presentation';
import { useOperationalSession } from '../operational/operational-session-provider';
import {
  OperationalTransactionHistoryApi,
  type OperationalSaleDetail,
  type OperationalSaleListItem,
} from './transaction-history-api';

const PAGE_SIZE = 20;

function isPositive(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    return createDecimal(value).greaterThan(0);
  } catch {
    return false;
  }
}

export function OperationalTransactionHistoryPage() {
  const bootstrap = useDeploymentBootstrap();
  const { authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, locale, formatDate, formatMoney } = useOperationalLocalization();
  const text = (id: string, en: string) => (locale === 'id-ID' ? id : en);
  const [offset, setOffset] = useState(0);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const api = useMemo(
    () =>
      new OperationalTransactionHistoryApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );
  const list = useQuery({
    queryKey: [
      'operational-transaction-history',
      selectedLocationId,
      offset,
      createdFrom,
      createdTo,
    ],
    enabled: Boolean(selectedLocationId),
    queryFn: () =>
      api.list({
        limit: PAGE_SIZE,
        offset,
        sellingLocationId: selectedLocationId ?? undefined,
        createdFrom,
        createdTo,
      }),
  });
  const detail = useQuery({
    queryKey: ['operational-transaction-detail', detailId],
    enabled: Boolean(detailId),
    queryFn: () => api.get(detailId!),
  });

  if (list.isError)
    return (
      <div className="p-5 md:p-6 lg:p-8">
        <DConnectionError
          title={copy('Could not load transaction history.')}
          message={copy('Try loading transaction history again.')}
          onRetry={() => void list.refetch()}
        />
      </div>
    );

  const columns: TableColumn<OperationalSaleListItem>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (row) =>
        formatDate(new Date(row.createdAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
    {
      key: 'saleNumber',
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
      key: 'total',
      label: copy('Total'),
      render: (row) => formatMoney(row.totalAmount, row.currency),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={row.status === 'FINALIZED' ? 'success' : 'outline'}>
          {label(row.status)}
        </DBadge>
      ),
    },
  ];

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
          {copy('Operations')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--color-text)]">
          {copy('Transaction history')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {copy('Operational transaction history for the active authorized location.')}
        </p>
      </header>

      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading || !selectedLocationId}
          rowKey="id"
          filters={
            <DRangeDatePicker
              label={copy('Period')}
              value={{ start: createdFrom, end: createdTo }}
              onChange={(range) => {
                setCreatedFrom(range.start ?? '');
                setCreatedTo(range.end ?? '');
                setOffset(0);
              }}
            />
          }
          actions={[
            {
              label: copy('View transaction'),
              icon: <Eye aria-hidden="true" className="size-4" />,
              onClick: (row) => setDetailId(row.id),
            },
          ]}
          pagination={{
            page: Math.floor(offset / PAGE_SIZE) + 1,
            pageSize: PAGE_SIZE,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
          emptyMessage={copy('No transactions match the current period.')}
        />
      </section>

      <DDialog
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={text('Detail transaksi', 'Transaction details')}
        className="w-full max-w-4xl"
      >
        {detail.isLoading ? (
          <div className="space-y-4" aria-label={text('Memuat detail transaksi', 'Loading transaction detail')}>
            <DSkeleton className="h-24 w-full rounded-2xl" />
            <DSkeleton className="h-44 w-full rounded-2xl" />
            <DSkeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : detail.data ? (
          <TransactionDetail
            sale={detail.data}
            locale={locale}
            text={text}
            label={label}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('Could not load transaction history.')}
          </p>
        )}
      </DDialog>
    </div>
  );
}

function TransactionDetail({
  sale,
  locale,
  text,
  label,
  formatDate,
  formatMoney,
}: {
  sale: OperationalSaleDetail;
  locale: string;
  text: (id: string, en: string) => string;
  label: (value: string) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (amount: string, currency?: string) => string;
}) {
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const discountRows = saleDiscountRows(sale);
  const successfulPayments = sale.payments.filter((payment) => payment.status === 'SUCCEEDED');
  const totalPaid = successfulPayments
    .reduce((sum, payment) => sum.plus(createDecimal(payment.appliedAmount)), createDecimal(0))
    .toFixed(4);
  const balance = createDecimal(sale.totalAmount).minus(createDecimal(totalPaid));
  const balanceDue = balance.greaterThan(0) ? balance.toFixed(4) : '0.0000';
  const cashTendered = successfulPayments
    .filter((payment) => payment.method === 'CASH' && payment.tenderedAmount)
    .reduce(
      (sum, payment) => sum.plus(createDecimal(payment.tenderedAmount ?? '0')),
      createDecimal(0),
    );
  const cashChange = successfulPayments
    .filter((payment) => payment.method === 'CASH')
    .reduce(
      (sum, payment) => sum.plus(createDecimal(payment.changeAmount ?? '0')),
      createDecimal(0),
    );

  return (
    <div className="max-h-[72vh] space-y-6 overflow-y-auto pr-1 text-sm">
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/35 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              {text('Transaksi', 'Transaction')}
            </p>
            <p className="mt-1 break-all font-mono text-base font-bold">{sale.saleNumber}</p>
            {sale.invoiceNumber ? (
              <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
                {sale.invoiceNumber}
              </p>
            ) : null}
          </div>
          <DBadge variant={sale.status === 'FINALIZED' ? 'success' : 'outline'}>
            {label(sale.status)}
          </DBadge>
        </div>
        <div className="mt-4 grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{text('Tanggal dan waktu', 'Date and time')}</p>
            <p className="mt-1 font-semibold">
              {formatDate(new Date(sale.finalizedAt ?? sale.createdAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">{text('Status pengerjaan', 'Work status')}</p>
            <p className="mt-1 font-semibold">{label(sale.operationalState)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-bold">{text('Pesanan', 'Order')}</h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            {activeLines.length} {text('item', 'items')}
          </span>
        </div>
        <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)]">
          {activeLines.map((line) => {
            const assigned = line.participations.filter((participation) => participation.assigned);
            const discountPercentage = lineDiscountPercentage(line);
            return (
              <article key={line.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{line.itemNameSnapshot}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {line.quantity.replace(/\.0+$/, '')} × {formatMoney(line.effectiveUnitPrice, sale.currency)}
                      {line.variantNameSnapshot ? `, ${line.variantNameSnapshot}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{formatMoney(line.grossAmount, sale.currency)}</p>
                </div>

                {isPositive(line.lineDiscountAmount) ? (
                  <div className="mt-2 flex justify-between gap-4 text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      {text('Diskon item', 'Item discount')}
                      {discountPercentage ? ` (${discountPercentage}%)` : ''}
                    </span>
                    <span className="font-semibold text-[var(--color-danger)]">
                      −{formatMoney(line.lineDiscountAmount, sale.currency)}
                    </span>
                  </div>
                ) : null}

                {line.itemTypeSnapshot === 'SERVICE' && assigned.length ? (
                  <div className="mt-3 border-t border-dashed border-[var(--color-border)] pt-3">
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">
                      {text('Pengerjaan', 'Service worker')}
                    </p>
                    <div className="mt-1 space-y-1 text-xs">
                      {assigned.map((participation) => {
                        const workerName = employeeDisplayName(
                          line,
                          participation.employeeId,
                          [],
                          text('Karyawan tidak tersedia', 'Employee unavailable'),
                        );
                        const share = participation.shareRate
                          ? `${createDecimal(participation.shareRate).times(100).toFixed(0)}%`
                          : null;
                        return (
                          <p key={participation.employeeId} className="font-semibold">
                            {workerName}{share ? ` ${share}` : ''}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {line.fulfillment ? (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {text('Status pengerjaan', 'Work status')}: <strong>{label(line.fulfillment.status)}</strong>
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {(discountRows.length > 0 || isPositive(sale.taxAmount)) ? (
        <section>
          <h3 className="mb-3 font-bold">{text('Penyesuaian dan pajak', 'Adjustments and tax')}</h3>
          <div className="space-y-2 rounded-2xl border border-[var(--color-border)] p-4">
            {discountRows.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {row.label}{row.percentage ? ` (${row.percentage}%)` : ''}
                  </p>
                  <p className="mt-0.5 text-[var(--color-text-muted)]">
                    {row.scope === 'TRANSACTION'
                      ? text('Transaksi', 'Transaction')
                      : row.scope === 'ITEM'
                        ? text('Item', 'Item')
                        : text('Kategori', 'Category')}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-[var(--color-danger)]">
                  −{formatMoney(row.amount, sale.currency)}
                </span>
              </div>
            ))}
            {isPositive(sale.taxAmount) ? (
              <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-2 text-xs">
                <span className="font-semibold">{saleTaxLabel(sale, text('Pajak', 'Tax'))}</span>
                <span className="font-semibold">{formatMoney(sale.taxAmount, sale.currency)}</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
        <div>
          <h3 className="mb-3 font-bold">{text('Pembayaran', 'Payment')}</h3>
          {sale.payments.length ? (
            <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)]">
              {sale.payments.map((payment) => (
                <article key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{label(payment.method)}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {label(payment.status)}
                        {payment.providerReference ? ` · ${payment.providerReference}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {formatDate(new Date(payment.terminalAt ?? payment.updatedAt), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <p className="font-bold">{formatMoney(payment.appliedAmount, payment.currency)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-text-muted)]">
              {text('Belum ada pembayaran untuk transaksi ini.', 'No payment has been recorded for this transaction.')}
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-bold">{text('Ringkasan', 'Summary')}</h3>
          <dl className="space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/30 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--color-text-muted)]">{text('Subtotal', 'Subtotal')}</dt>
              <dd>{formatMoney(sale.grossAmount, sale.currency)}</dd>
            </div>
            {isPositive(sale.discountAmount) ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{text('Promo dan diskon', 'Promotions and discounts')}</dt>
                <dd>−{formatMoney(sale.discountAmount, sale.currency)}</dd>
              </div>
            ) : null}
            {isPositive(sale.taxAmount) ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--color-text-muted)]">{saleTaxLabel(sale, text('Pajak', 'Tax'))}</dt>
                <dd>{formatMoney(sale.taxAmount, sale.currency)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-2 font-bold">
              <dt>{text('Total', 'Total')}</dt>
              <dd>{formatMoney(sale.totalAmount, sale.currency)}</dd>
            </div>
            {successfulPayments.length ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-text-muted)]">{text('Dibayar', 'Paid')}</dt>
                  <dd>{formatMoney(totalPaid, sale.currency)}</dd>
                </div>
                {isPositive(balanceDue) ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-text-muted)]">{text('Sisa', 'Balance')}</dt>
                    <dd>{formatMoney(balanceDue, sale.currency)}</dd>
                  </div>
                ) : null}
                {cashTendered.greaterThan(0) ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-text-muted)]">{text('Uang diterima', 'Cash received')}</dt>
                    <dd>{formatMoney(cashTendered.toFixed(4), sale.currency)}</dd>
                  </div>
                ) : null}
                {cashChange.greaterThan(0) ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--color-text-muted)]">{text('Kembalian', 'Change')}</dt>
                    <dd>{formatMoney(cashChange.toFixed(4), sale.currency)}</dd>
                  </div>
                ) : null}
              </>
            ) : null}
          </dl>
        </div>
      </section>
    </div>
  );
}