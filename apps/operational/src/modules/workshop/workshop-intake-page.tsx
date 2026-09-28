import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  cn,
  DAlert,
  DBadge,
  DButton,
  DDataTable,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { liveQueryPolicy, QUEUE_REFRESH_INTERVAL_MS } from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import { WorkshopIntakeDialog } from './workshop-intake-form';
import { canReadWorkshopQueue } from './workshop-queue-actions';
import {
  WorkshopQueueApi,
  type WorkshopQueueWorkOrder,
  type WorkshopWorkOrderStatus,
} from './workshop-queue-api';
import { STATUS_BADGE_VARIANT } from './workshop-status-presentation';

export { canCreateWorkshopCustomer } from './workshop-intake-form';

const PAGE_SIZE = 10;

const STATUS_TABS: readonly (WorkshopWorkOrderStatus | '')[] = [
  '',
  'WAITING',
  'ASSIGNED',
  'IN_PROGRESS',
  'PAUSED',
  'DONE',
  'CANCELLED',
];

/**
 * Penerimaan is the Workshop intake management surface. Existing Work Orders
 * stay visible behind the creation flow; creating a new Work Order happens in
 * a centered DDialog rather than replacing the page or opening a side drawer.
 */
export function WorkshopIntakePage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, formatDate } = useOperationalLocalization();
  const navigate = useNavigate();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkshopWorkOrderStatus | ''>('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);

  const canReadQueue = canReadWorkshopQueue(session.access.permissions);
  const openQueue = () => void navigate('/workshop/queue');

  const api = useMemo(
    () =>
      new WorkshopQueueApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          applicationSurface: 'operational',
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );

  const workOrders = useQuery({
    queryKey: ['workshop-queue', selectedLocationId, 'intake', statusFilter, query, offset],
    enabled: Boolean(selectedLocationId && canReadQueue),
    queryFn: () =>
      api.list({
        limit: PAGE_SIZE,
        offset,
        sellingLocationId: selectedLocationId!,
        q: query.trim() || undefined,
        status: statusFilter || undefined,
      }),
    ...liveQueryPolicy,
    refetchInterval: QUEUE_REFRESH_INTERVAL_MS,
  });

  const columns: TableColumn<WorkshopQueueWorkOrder>[] = [
    {
      key: 'workOrderNumber',
      label: copy('Work Order number'),
      render: (row) => (
        <div>
          <p className="font-semibold text-(--color-text)">{row.workOrderNumber}</p>
          <div className="mt-1">
            <DBadge variant={STATUS_BADGE_VARIANT[row.workStatus]}>{label(row.workStatus)}</DBadge>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: copy('Created'),
      render: (row) =>
        formatDate(new Date(row.createdAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
    {
      key: 'customerNameSnapshot',
      label: copy('Customer'),
      render: (row) => (
        <div>
          <p className="font-medium text-(--color-text)">{row.customerNameSnapshot}</p>
          <p className="text-sm text-(--color-text-muted)">{row.customerPhoneSnapshot}</p>
        </div>
      ),
    },
    {
      key: 'vehiclePlateSnapshot',
      label: copy('Vehicle'),
      render: (row) => (
        <span className="font-semibold tracking-wide text-(--color-text)">
          {row.vehiclePlateSnapshot}
        </span>
      ),
    },
    {
      key: 'customerRequest',
      label: copy('Keluhan'),
      render: (row) => <span className="line-clamp-2">{row.customerRequest}</span>,
    },
  ];

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Workshop')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Intake')}</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {copy('Keluhan / Permintaan Customer sebelum diagnosis mekanik.')}
          </p>
        </div>

        <DButton
          className="w-full sm:w-auto"
          disabled={!selectedLocationId}
          onClick={() => setCreateOpen(true)}
        >
          {copy('Create Work Order')}
        </DButton>
      </header>

      {!selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      {canReadQueue ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface)">
          <div className="overflow-x-auto border-b border-(--color-border) px-3 md:px-4">
            <div className="flex min-w-max gap-1">
              {STATUS_TABS.map((status) => {
                const active = statusFilter === status;
                return (
                  <button
                    key={status || 'ALL'}
                    type="button"
                    onClick={() => {
                      setStatusFilter(status);
                      setOffset(0);
                    }}
                    className={cn(
                      'relative px-3 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'text-(--color-brand)'
                        : 'text-(--color-text-muted) hover:text-(--color-text)',
                    )}
                  >
                    {status ? label(status) : copy('All')}
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-(--color-brand)"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {workOrders.isError ? (
            <div className="p-4">
              <DAlert
                variant="danger"
                title={copy('Could not load the Workshop queue.')}
                action={
                  <DButton variant="secondary" size="sm" onClick={() => void workOrders.refetch()}>
                    {copy('Retry')}
                  </DButton>
                }
              />
            </div>
          ) : (
            <DDataTable
              columns={columns}
              data={workOrders.data?.items ?? []}
              loading={workOrders.isLoading || !selectedLocationId}
              rowKey="id"
              searchable
              searchPlaceholder={copy('Search by Work Order number')}
              searchValue={query}
              onSearchChange={(value) => {
                setQuery(value);
                setOffset(0);
              }}
              pagination={{
                page: Math.floor(offset / PAGE_SIZE) + 1,
                pageSize: PAGE_SIZE,
                total: workOrders.data?.total ?? 0,
              }}
              onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
              emptyMessage={
                query.trim() || statusFilter
                  ? copy('No Work Orders match the current filters.')
                  : copy('No Work Orders at this branch yet.')
              }
            />
          )}

          <div className="flex justify-end border-t border-(--color-border) px-4 py-3">
            <DButton variant="link" size="sm" className="px-0" onClick={openQueue}>
              {copy('Open queue')}
            </DButton>
          </div>
        </section>
      ) : null}

      <WorkshopIntakeDialog
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        {...(canReadQueue ? { onOpenQueue: openQueue } : {})}
      />
    </div>
  );
}
