import { DConnectionError, DDataTable, type TableColumn } from '@digvation/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRuntime } from '@digvation/business-runtime';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import { useListQuery } from '../../../shared/query/use-list-query';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import { TransactionHistoryApi, type Sale } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import {
  paymentSummary,
  transactionStatusSummary,
  workSummary,
} from '../model/transaction-summary';
import { TransactionDetailDialog } from './transaction-detail-dialog';
import {
  EMPTY_TRANSACTION_FILTERS,
  TransactionHistoryFilters,
  toTransactionQuery,
  type TransactionFilterState,
} from './transaction-history-filters';
import { SummaryBadge } from './transaction-presentation';

export const transactionHistoryKeys = { list: ['transaction-history'] as const };

export function TransactionHistoryPage() {
  const { createApiClient, session } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatDate, formatMoney } = useTransactionHistoryLocalization();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new TransactionHistoryApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const filters = useFormState<TransactionFilterState>(EMPTY_TRANSACTION_FILTERS);
  const query = filters.values;
  const pagination = usePaginationState({ initialPageSize: 20 });
  // The selected transaction outlives the dialog's visibility so closing can fade out intact.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const list = useListQuery({
    queryKey: [...transactionHistoryKeys.list, query],
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
    queryFn: (page) => api.list({ ...toTransactionQuery(query), ...(page ?? pagination.request) }),
  });
  const permissions = session?.access.permissions ?? [];

  const changeFilter = (change: Partial<TransactionFilterState>) => {
    pagination.resetPage();
    filters.patch(change);
  };

  const columns: TableColumn<Sale>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (sale) => (
        <span className="whitespace-nowrap">
          {formatDate(new Date(sale.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'sale',
      label: copy('Transaction number'),
      render: (sale) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold">{sale.saleNumber}</p>
          {sale.invoiceNumber ? (
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">
              {sale.invoiceNumber}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'amount',
      label: copy('Total'),
      align: 'right',
      render: (sale) => (
        <span className="whitespace-nowrap font-medium tabular-nums">
          {formatMoney(sale.totalAmount, sale.currency)}
        </span>
      ),
    },
    {
      key: 'saleStatus',
      label: copy('Transaction status'),
      render: (sale) => <SummaryBadge summary={transactionStatusSummary(sale)} />,
    },
    {
      key: 'payment',
      label: copy('Payment'),
      render: (sale) => <SummaryBadge summary={paymentSummary(sale)} />,
    },
    {
      key: 'work',
      label: copy('Work'),
      render: (sale) => {
        const work = workSummary(sale);
        return work.kind === 'NONE' ? (
          <span className="text-sm text-[var(--color-text-muted)]">{copy(work.label)}</span>
        ) : (
          <SummaryBadge summary={work} />
        );
      },
    },
  ];

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Reporting')}
        title={copy('Transaction history')}
        description={copy('Review transactions, payments, and work status.')}
      />
      <section className="mt-6">
        {list.isError ? (
          <DConnectionError
            title={copy('Could not load transaction history.')}
            message={copy('Try loading transaction history again.')}
            onRetry={() => void list.refetch()}
            isRetrying={list.isFetching}
          />
        ) : (
          <DDataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey="id"
            searchable
            searchPlaceholder={copy('Search number, reference, or location...')}
            searchValue={query.q}
            onSearchChange={(q) => changeFilter({ q })}
            filters={<TransactionHistoryFilters value={query} onChange={changeFilter} />}
            actions={[
              {
                label: copy('View transaction'),
                icon: <Eye aria-hidden="true" className="size-4" />,
                onClick: (sale) => {
                  setSelectedId(sale.id);
                  setDetailOpen(true);
                },
              },
            ]}
            pagination={{
              page: pagination.page,
              pageSize: pagination.pageSize,
              total: list.data?.total ?? 0,
            }}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            emptyMessage={copy('No transactions match the current filters.')}
          />
        )}
      </section>
      <TransactionDetailDialog
        open={detailOpen}
        saleId={selectedId}
        initialSale={list.data?.items.find((sale) => sale.id === selectedId)}
        api={api}
        permissions={{
          refund: permissions.includes('payments:refund'),
          correct: permissions.includes('payments:correct'),
          reverse: permissions.includes('sales:reverse'),
        }}
        onClose={() => setDetailOpen(false)}
        onChanged={() =>
          void queryClient.invalidateQueries({ queryKey: transactionHistoryKeys.list })
        }
      />
    </BackofficePage>
  );
}
