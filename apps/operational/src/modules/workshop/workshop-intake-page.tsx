import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  cn,
  DAlert,
  DBadge,
  DButton,
  DDataTable,
  DInput,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
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
 * Penerimaan remains the Workshop management surface. Existing Work Orders
 * stay visible while creation runs inside the centered intake DDialog.
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
        <div className="min-w-36">
          <p className="font-semibold text-(--color-text)">{row.workOrderNumber}</p>
          <div className="mt-1.5">
            <DBadge variant={STATUS_BADGE_VARIANT[row.workStatus]}>{label(row.workStatus)}</DBadge>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: copy('Created'),
      render: (row) => {
        const createdAt = new Date(row.createdAt);
        return (
          <div className="min-w-28 text-sm tabular-nums">
            <p className="text-(--color-text)">
              {formatDate(createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <p className="mt-0.5 text-(--color-text-muted)">
              {formatDate(createdAt, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        );
      },
    },
    {
      key: 'customerNameSnapshot',
      label: copy('Customer'),
      render: (row) => (
        <div className="min-w-40">
          <p className="font-medium text-(--color-text)">{row.customerNameSnapshot}</p>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">{row.customerPhoneSnapshot}</p>
        </div>
      ),
    },
    {
      key: 'vehiclePlateSnapshot',
      label: copy('Vehicle'),
      render: (row) => (
        <div className="min-w-32">
          <p className="font-semibold tracking-wide text-(--color-text)">{row.vehiclePlateSnapshot}</p>
          <p className="mt-0.5 max-w-44 truncate text-xs text-(--color-text-muted)">
            {row.vehicleChassisNumberSnapshot}
          </p>
        </div>
      ),
    },
    {
      key: 'customerRequest',
      label: copy('Keluhan'),
      render: (row) => (
        <span className="line-clamp-2 min-w-44 text-sm text-(--color-text-muted)">
          {row.customerRequest}
        </span>
      ),
    },
  ];

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Workshop')}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-(--color-text)">
            {copy('Intake')}
          </h1>
          <p className="mt-1.5 text-sm text-(--color-text-muted)">
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
        <section className="mt-6 overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-sm [&_[data-ds-component=data-table]]:rounded-none [&_[data-ds-component=data-table]]:border-0">
          <div className="overflow-x-auto border-b border-(--color-border) px-3 sm:px-4">
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
                      'relative px-3.5 py-3.5 text-sm font-semibold transition-colors',
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

          <div className="flex flex-col gap-3 border-b border-(--color-border) bg-(--color-surface-muted)/20 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <DInput
              type="search"
              value={query}
              onChange={(value) => {
                setQuery(value);
                setOffset(0);
              }}
              leftIcon={<Search className="size-4" aria-hidden="true" />}
              placeholder={copy('Search Work Orders, customers, or vehicles')}
              containerClassName="w-full sm:max-w-xl"
            />
            <DButton variant="secondary" size="sm" className="w-full sm:w-auto" onClick={openQueue}>
              <span className="inline-flex items-center gap-1.5">
                {copy('Open queue')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </DButton>
          </div>

          {workOrders.isError ? (
            <div className="p-4">
              <DAlert variant="danger" title={copy('Could not load the Workshop queue.')} />
              <DButton
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void workOrders.refetch()}
              >
                {copy('Retry')}
              </DButton>
            </div>
          ) : (
            <DDataTable
              columns={columns}
              data={workOrders.data?.items ?? []}
              loading={workOrders.isLoading || !selectedLocationId}
              rowKey="id"
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
