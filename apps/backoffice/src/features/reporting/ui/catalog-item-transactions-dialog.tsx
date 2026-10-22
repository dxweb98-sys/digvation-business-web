import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DConnectionError,
  DDataTable,
  DInfoNote,
  DSkeleton,
  type BadgeVariant,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import {
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import {
  ReportingApi,
  type CatalogItemTransactionsDetail,
  type ReportRow,
} from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import { formatReportValue } from '../model/report-format';
import type { EmployeeDetailScope } from './employee-performance-dialog';
import { DetailShell, UnavailableDetail } from './report-detail-shell';
import { ReportTransactionDetail } from './report-transaction-detail';

type TransactionRecord = CatalogItemTransactionsDetail['records']['items'][number];

const RECORDS_PAGE_SIZE = 10;

const REFUND_STATE: Record<
  TransactionRecord['refundState'],
  { label: string; variant: BadgeVariant }
> = {
  NONE: { label: 'No refund', variant: 'outline' },
  PARTIAL: { label: 'Partly refunded', variant: 'info' },
  FULL: { label: 'Fully refunded', variant: 'secondary' },
};

/**
 * The transactions behind one Catalog Performance row, read-only. The Runtime computes the summary
 * over every matching record with the same filters as the row, so "4 transactions / 6 units" is
 * explained by exactly those records; only the page is loaded.
 */
export function CatalogItemTransactionsDialog({
  row,
  scope,
  open,
  onClose,
}: {
  row: ReportRow;
  scope: EmployeeDetailScope;
  open: boolean;
  onClose: () => void;
}) {
  const { createApiClient, getAccessToken, session } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy, format } = useReportingLocalization();
  const api = useMemo(
    () => new ReportingApi(createApiClient(apiBaseUrl), apiBaseUrl, getAccessToken),
    [apiBaseUrl, createApiClient, getAccessToken],
  );
  const item = {
    catalogItemId: String(row.catalogItemId ?? ''),
    catalogVariantId: row.catalogVariantId ? String(row.catalogVariantId) : null,
  };
  const [page, setPage] = useState(1);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const detail = useQuery({
    queryKey: ['reporting-catalog-item-transactions', item, scope.query, page],
    queryFn: () =>
      api.catalogItemTransactions(item, scope.query, { page, pageSize: RECORDS_PAGE_SIZE }),
    enabled: open && Boolean(item.catalogItemId),
    retry: 1,
  });
  // The full transaction lives in Transaction History, readable only with this permission.
  const canOpenSale = Boolean(session?.access.permissions.includes('sales:read-completed'));
  const money = (value: string) => formatReportValue('money', value, format);
  const quantity = (value: string) => formatReportValue('quantity', value, format);
  const count = (value: number) => formatReportValue('count', value, format);
  const period =
    scope.query.dateFrom === scope.query.dateTo
      ? formatReportValue('date', scope.query.dateFrom, format)
      : `${formatReportValue('date', scope.query.dateFrom, format)} – ${formatReportValue('date', scope.query.dateTo, format)}`;
  const data = detail.data;
  const title = copy('Catalog performance detail');

  if (!item.catalogItemId) return <UnavailableDetail open={open} onClose={onClose} title={title} />;

  const columns: TableColumn<TransactionRecord>[] = [
    {
      key: 'occurredAt',
      label: copy('Date'),
      render: (record) => formatReportValue('datetime', record.occurredAt, format),
    },
    {
      key: 'saleNumber',
      label: copy('Transaction'),
      render: (record) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-mono text-xs font-semibold">{record.saleNumber}</p>
          <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">
            {[record.invoiceNumber, record.sellingLocation].filter(Boolean).join(' · ')}
          </p>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: copy('Quantity sold'),
      align: 'right',
      render: (record) => <span className="tabular-nums">{quantity(record.quantity)}</span>,
    },
    {
      key: 'grossAmount',
      label: copy('Original amount'),
      align: 'right',
      render: (record) => (
        <div className="whitespace-nowrap tabular-nums">
          <p>{money(record.grossAmount)}</p>
          {/^-?0(\.0+)?$/.test(record.discountAmount) ? null : (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {copy('Discount')} −{money(record.discountAmount)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'taxAmount',
      label: copy('Tax'),
      align: 'right',
      render: (record) => (
        <span className="whitespace-nowrap tabular-nums">{money(record.taxAmount)}</span>
      ),
    },
    {
      key: 'lineAmount',
      label: copy('Item amount'),
      align: 'right',
      render: (record) => (
        <span className="whitespace-nowrap font-semibold tabular-nums">
          {money(record.lineAmount)}
        </span>
      ),
    },
    {
      key: 'refundState',
      label: copy('Money returned'),
      render: (record) => {
        const state = REFUND_STATE[record.refundState];
        return (
          <div className="min-w-0">
            <DBadge variant={state.variant}>{copy(state.label)}</DBadge>
            {record.refundState === 'NONE' ? null : (
              <p className="mt-1 whitespace-nowrap text-xs tabular-nums text-[var(--color-text-muted)]">
                {money(record.saleRefundAmount)}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DetailShell open={open} onClose={onClose} title={title}>
        {detail.isError ? (
          <DConnectionError
            title={copy('Could not load the transactions for this item.')}
            message={
              normalizeBackofficeApiError(detail.error, copy('Check the connection and try again.'))
                .safeMessage
            }
            onRetry={() => void detail.refetch()}
            isRetrying={detail.isFetching}
          />
        ) : !data ? (
          <div role="status" aria-label={copy('Loading transactions…')} className="space-y-4">
            <DSkeleton height={112} rounded="lg" />
            <DSkeleton height={200} rounded="lg" />
          </div>
        ) : (
          <>
            <RecordPanel>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
                {/* What was sold, and where and when the figures come from. */}
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
                    {data.item.itemName ?? String(row.itemName ?? '—')}
                  </h2>
                  {data.item.itemType || data.item.variantName ? (
                    <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">
                      {[
                        data.item.itemType
                          ? copy(data.item.itemType === 'SERVICE' ? 'Service' : 'Product')
                          : null,
                        data.item.variantName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-3 break-words text-xs text-[var(--color-text-muted)]">
                    {period} · {scope.locationName ?? copy('All locations')}
                  </p>
                </div>
                {/* The one strong number, with the counts that explain it right under it. */}
                <div className="min-w-0 basis-full sm:basis-auto sm:text-right">
                  <RecordSectionLabel>{copy('Revenue')}</RecordSectionLabel>
                  <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
                    {money(data.summary.finalRevenue)}
                  </p>
                  <p className="mt-1 text-sm tabular-nums text-[var(--color-text-muted)]">
                    {count(data.summary.transactionCount)} {copy('transactions')} ·{' '}
                    {quantity(data.summary.quantitySold)}{' '}
                    {copy(
                      data.item.itemType === 'SERVICE'
                        ? 'services'
                        : data.item.itemType === 'PRODUCT'
                          ? 'products'
                          : 'sold',
                    )}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--color-text-muted)]">{copy('Discount')}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-[var(--color-text)]">
                    {money(data.summary.discountAmount)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--color-text-muted)]">{copy('Tax')}</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-[var(--color-text)]">
                    {money(data.summary.taxAmount)}
                  </dd>
                </div>
              </dl>
            </RecordPanel>

            {data.records.items.some((record) => record.refundState !== 'NONE') ? (
              <DInfoNote variant="info">
                {copy(
                  'Some of these transactions later returned money to the customer. A refund belongs to the whole transaction, so the item amount here is not reduced by it.',
                )}
              </DInfoNote>
            ) : null}

            <RecordPanel padded={false} ariaLabel={copy('Transactions behind this item')}>
              <RecordPanelHeader
                title={copy('Transactions behind this item')}
                count={data.records.total}
              />
              <RecordPanelBody>
                <DDataTable
                  rowKey={(record) => record.saleId}
                  data={data.records.items}
                  columns={columns}
                  loading={detail.isFetching}
                  emptyMessage={copy('No transactions sold this item in this period.')}
                  pagination={{
                    page: data.records.page,
                    pageSize: data.records.pageSize,
                    total: data.records.total,
                  }}
                  onPageChange={setPage}
                  {...(canOpenSale
                    ? {
                        actions: [
                          {
                            label: copy('View transaction'),
                            icon: <Eye aria-hidden="true" className="size-4" />,
                            onClick: (record: TransactionRecord) => {
                              setSaleId(record.saleId);
                              setSaleOpen(true);
                            },
                          },
                        ],
                      }
                    : {})}
                />
              </RecordPanelBody>
            </RecordPanel>
          </>
        )}
      </DetailShell>
      {saleId ? (
        <ReportTransactionDetail
          row={{ saleId }}
          open={saleOpen}
          onClose={() => setSaleOpen(false)}
        />
      ) : null}
    </>
  );
}
