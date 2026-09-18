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

import {
  historyQueryPolicy,
  transactionQueryPolicy,
} from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import {
  SaleDetailHeader,
  SaleDetailSection,
  SaleFinancialSummary,
  SaleLineItem,
  SaleLineItemList,
  SalePaymentList,
  StatusPill,
} from '../../features/sell/components/sale-detail-presentation';
import {
  employeeDisplayName,
  formatServiceDuration,
  lineDiscountPercentage,
  saleDiscountRows,
  saleSettlement,
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

const fulfillmentTone: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  WAITING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELED: 'danger',
};

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
  // Keep the last opened transaction rendered while the dialog plays its close transition.
  const [displayedDetailId, setDisplayedDetailId] = useState<string | null>(null);
  if (detailId !== null && detailId !== displayedDetailId) setDisplayedDetailId(detailId);
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
    ...historyQueryPolicy,
  });
  const detail = useQuery({
    queryKey: ['operational-transaction-detail', displayedDetailId],
    enabled: Boolean(displayedDetailId),
    queryFn: () => api.get(displayedDetailId!),
    ...transactionQueryPolicy,
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
            <p className="mt-1 font-mono text-xs text-(--color-text-muted)">{row.invoiceNumber}</p>
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
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Operations')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">
          {copy('Transaction history')}
        </h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
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
        description={detail.data?.saleNumber}
        size="xl"
        noPadding
        className="w-full"
      >
        {detail.isLoading ? (
          <div
            className="space-y-4 px-5 py-5 sm:px-6"
            aria-label={text('Memuat detail transaksi', 'Loading transaction detail')}
          >
            <DSkeleton className="h-24 w-full rounded-2xl" />
            <DSkeleton className="h-44 w-full rounded-2xl" />
            <DSkeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : detail.data ? (
          <TransactionDetail
            sale={detail.data}
            locale={locale}
            copy={copy}
            text={text}
            label={label}
            formatDate={formatDate}
            formatMoney={formatMoney}
          />
        ) : (
          <p className="px-5 py-5 text-sm text-(--color-text-muted) sm:px-6">
            {copy('Could not load transaction history.')}
          </p>
        )}
      </DDialog>
    </div>
  );
}

function TransactionDetail({
  sale,
  copy,
  text,
  label,
  formatDate,
  formatMoney,
}: {
  sale: OperationalSaleDetail;
  locale: string;
  copy: (value: string) => string;
  text: (id: string, en: string) => string;
  label: (value: string) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const discountRows = saleDiscountRows(sale);
  const settlement = saleSettlement(sale);
  const format = (amount: string) => formatMoney(amount, sale.currency);
  const summaryDiscounts =
    discountRows.length === 0 && isPositive(sale.discountAmount)
      ? [
          {
            id: 'sale-discount',
            source: 'MANUAL_DISCOUNT' as const,
            scope: 'TRANSACTION' as const,
            saleLineId: null,
            label: text('Promo dan diskon', 'Promotions and discounts'),
            amount: sale.discountAmount,
            percentage: null,
          },
        ]
      : discountRows;
  const dateTime = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="pos-detail-story max-h-[76vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
      <SaleDetailHeader
        eyebrow={text('Transaksi', 'Transaction')}
        number={sale.saleNumber}
        secondaryNumber={sale.invoiceNumber}
        badges={
          <>
            <StatusPill
              tone={
                sale.status === 'FINALIZED'
                  ? 'success'
                  : sale.status === 'VOIDED'
                    ? 'danger'
                    : 'brand'
              }
            >
              {label(sale.status)}
            </StatusPill>
            <StatusPill
              tone={
                settlement.paymentState === 'PAID'
                  ? 'success'
                  : settlement.paymentState === 'PARTIALLY_PAID'
                    ? 'warning'
                    : 'neutral'
              }
            >
              {copy(
                settlement.paymentState === 'PAID'
                  ? 'Paid'
                  : settlement.paymentState === 'PARTIALLY_PAID'
                    ? 'Partially paid'
                    : 'Unpaid',
              )}
            </StatusPill>
          </>
        }
        totalLabel={text('Total', 'Total')}
        total={format(sale.totalAmount)}
        settlementNote={
          isPositive(settlement.balanceDue) ? (
            <span className="text-[var(--color-warning)]">
              {copy('Balance due')} {format(settlement.balanceDue)}
            </span>
          ) : null
        }
        meta={[
          {
            label: text('Tanggal dan waktu', 'Date and time'),
            value: dateTime(sale.finalizedAt ?? sale.createdAt),
          },
          ...(sale.status === 'OPEN'
            ? [
                {
                  label: text('Status pengerjaan', 'Work status'),
                  value: label(sale.operationalState),
                },
              ]
            : []),
        ]}
      />

      <div className="pos-detail-columns">
        <div className="pos-detail-column">
          <SaleDetailSection
            title={text('Pesanan', 'Order')}
            aside={`${activeLines.length} ${text('item', 'items')}`}
          >
            <SaleLineItemList>
              {activeLines.map((line) => {
                const assigned = line.participations.filter(
                  (participation) => participation.assigned,
                );
                const discountPercentage = lineDiscountPercentage(line);
                const performers = assigned
                  .map((participation) => {
                    const workerName = employeeDisplayName(
                      line,
                      participation.employeeId,
                      [],
                      text('Karyawan tidak tersedia', 'Employee unavailable'),
                    );
                    const share = participation.shareRate
                      ? `${createDecimal(participation.shareRate).times(100).toFixed(0)}%`
                      : null;
                    return share ? `${workerName} ${share}` : workerName;
                  })
                  .join(', ');
                const durationLabel = formatServiceDuration(line.defaultDurationMinutesSnapshot, {
                  hour: copy('hour-short'),
                  minute: copy('minute-short'),
                });
                const hasContext =
                  line.fulfillment ||
                  durationLabel ||
                  (line.itemTypeSnapshot === 'SERVICE' && performers);
                return (
                  <SaleLineItem
                    key={line.id}
                    name={line.itemNameSnapshot}
                    pricing={`${line.quantity.replace(/\.0+$/, '')} × ${format(line.effectiveUnitPrice)}${line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}`}
                    amount={format(line.grossAmount)}
                    discount={
                      isPositive(line.lineDiscountAmount)
                        ? {
                            label: `${text('Diskon item', 'Item discount')}${discountPercentage ? ` (${discountPercentage}%)` : ''}`,
                            amount: format(line.lineDiscountAmount),
                          }
                        : null
                    }
                    context={
                      hasContext ? (
                        <>
                          {line.fulfillment ? (
                            <StatusPill
                              tone={fulfillmentTone[line.fulfillment.status] ?? 'neutral'}
                            >
                              {label(line.fulfillment.status)}
                            </StatusPill>
                          ) : null}
                          {durationLabel ? <span>{durationLabel}</span> : null}
                          {line.itemTypeSnapshot === 'SERVICE' && performers ? (
                            <span className="min-w-0 truncate">
                              {copy('Performed by')} {performers}
                            </span>
                          ) : null}
                        </>
                      ) : null
                    }
                  />
                );
              })}
            </SaleLineItemList>
          </SaleDetailSection>
        </div>

        <div className="pos-detail-column">
          <SaleDetailSection title={copy('Order summary')} surface="muted">
            <SaleFinancialSummary
              labels={{
                subtotal: text('Subtotal', 'Subtotal'),
                total: text('Total', 'Total'),
                paid: text('Dibayar', 'Paid'),
                balance: copy('Balance due'),
                settled: copy('Paid'),
                cashReceived: text('Uang diterima', 'Cash received'),
                change: text('Kembalian', 'Change'),
                discountContext: (row) =>
                  `${copy(row.source === 'PROMOTION' ? 'Promotion' : 'Manual discount')} · ${copy(
                    row.scope === 'TRANSACTION'
                      ? 'Whole transaction'
                      : row.scope === 'ITEM'
                        ? 'Item-level'
                        : 'Category-level',
                  )}`,
              }}
              gross={sale.grossAmount}
              discounts={summaryDiscounts}
              tax={
                isPositive(sale.taxAmount)
                  ? { label: saleTaxLabel(sale, text('Pajak', 'Tax')), amount: sale.taxAmount }
                  : null
              }
              total={sale.totalAmount}
              settlement={settlement}
              format={format}
            />
          </SaleDetailSection>

          <SaleDetailSection title={copy('Payment history')}>
            <SalePaymentList
              emptyLabel={copy('No payment recorded yet.')}
              payments={sale.payments.map((payment) => ({
                id: payment.id,
                method: label(payment.method),
                status: (
                  <StatusPill
                    tone={
                      payment.status === 'SUCCEEDED'
                        ? 'success'
                        : payment.status === 'PENDING'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {label(payment.status)}
                  </StatusPill>
                ),
                detail: [
                  dateTime(payment.terminalAt ?? payment.updatedAt),
                  payment.providerReference,
                ]
                  .filter(Boolean)
                  .join(' · '),
                amount: formatMoney(payment.appliedAmount, payment.currency),
              }))}
            />
          </SaleDetailSection>
        </div>
      </div>
    </div>
  );
}
