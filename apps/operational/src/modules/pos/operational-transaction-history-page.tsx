import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useRuntime } from '@digvation/business-runtime';
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
import { useOperationalSession } from '../operational/operational-session-provider';
import { OperationalTransactionHistoryApi, type OperationalSale } from './transaction-history-api';

const PAGE_SIZE = 20;

export function OperationalTransactionHistoryPage() {
  const runtime = useRuntime();
  const { authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, formatDate, formatMoney } = useOperationalLocalization();
  const [offset, setOffset] = useState(0);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const api = useMemo(
    () =>
      new OperationalTransactionHistoryApi(
        new ApiClient({
          baseUrl: runtime.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, runtime.apiBaseUrl],
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

  const columns: TableColumn<OperationalSale>[] = [
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
        title={copy('Transaction history')}
        className="w-full max-w-lg"
      >
        {detail.isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">...</p>
        ) : detail.data ? (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--color-text-muted)]">{copy('Transaction number')}</dt>
              <dd className="mt-1 font-mono font-semibold">{detail.data.saleNumber}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{copy('Status')}</dt>
              <dd className="mt-1 font-semibold">{label(detail.data.status)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{copy('Date')}</dt>
              <dd className="mt-1 font-semibold">
                {formatDate(new Date(detail.data.createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{copy('Total')}</dt>
              <dd className="mt-1 font-semibold">
                {formatMoney(detail.data.totalAmount, detail.data.currency)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('Could not load transaction history.')}
          </p>
        )}
      </DDialog>
    </div>
  );
}
