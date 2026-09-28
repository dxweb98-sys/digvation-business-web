import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DAlert,
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDialog,
  DSelect,
  DTextarea,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { liveQueryPolicy, QUEUE_REFRESH_INTERVAL_MS } from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { useOperationalSession } from '../operational/operational-session-provider';
import {
  availableWorkshopQueueActions,
  WORKSHOP_QUEUE_ERROR_COPY,
  type WorkshopQueueAction,
} from './workshop-queue-actions';
import { STATUS_BADGE_VARIANT } from './workshop-status-presentation';
import { useLocationBoundQueueState } from './workshop-queue-location-state';
import {
  WorkshopQueueApi,
  type WorkshopQueueWorkOrder,
  type WorkshopWorkOrderStatus,
} from './workshop-queue-api';

const PAGE_SIZE = 20;

function apiErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

function apiErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | undefined)?.status;
}

export function WorkshopQueuePage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, formatDate } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Offset, the open detail and the cancellation form belong to the active
  // Operational location and reset when it changes; search and status filter
  // are page-level and are kept.
  const {
    offset,
    setOffset,
    selected,
    setSelected,
    cancelReason,
    setCancelReason,
    isCancelling,
    setCancelling,
  } = useLocationBoundQueueState(selectedLocationId);
  const [workOrderNumberQuery, setWorkOrderNumberQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkshopWorkOrderStatus | ''>('');

  const permissions = session.access.permissions;
  const canRead = permissions.includes('workshop-queue:read');

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

  const queue = useQuery({
    queryKey: [
      'workshop-queue',
      selectedLocationId,
      offset,
      workOrderNumberQuery,
      statusFilter,
    ],
    enabled: Boolean(selectedLocationId && canRead),
    queryFn: () =>
      api.list({
        limit: PAGE_SIZE,
        offset,
        sellingLocationId: selectedLocationId!,
        q: workOrderNumberQuery || undefined,
        status: statusFilter || undefined,
      }),
    ...liveQueryPolicy,
    refetchInterval: QUEUE_REFRESH_INTERVAL_MS,
  });

  function applyAuthoritative(workOrder: WorkshopQueueWorkOrder) {
    // A command that finishes after the user switched location must not
    // re-open the previous location's Work Order.
    if (workOrder.sellingLocationId === selectedLocationId) setSelected(workOrder);
    void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
  }

  function commandError(error: unknown) {
    const code = apiErrorCode(error);
    const known = WORKSHOP_QUEUE_ERROR_COPY[code ?? ''];
    // Runtime answers both an invalid transition and a stale `expectedVersion`
    // with 409; the code decides the message, a bare 409 is the stale version.
    if (known || apiErrorStatus(error) === 409) {
      showToast({
        variant: 'danger',
        title: copy(known ?? 'This Work Order was just changed. Open it again.'),
      });
      // The open detail still carries the old version, so a retry would fail
      // the same way. Close it; the refreshed queue holds the current one.
      if (code !== 'WORKSHOP_CANCELLATION_REASON_REQUIRED') closeDetail();
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      return;
    }
    showToast({
      variant: 'danger',
      title: copy('Could not update the Work Order. Try again.'),
    });
  }

  function closeDetail() {
    setSelected(null);
    setCancelling(false);
    setCancelReason('');
  }

  const pause = useMutation({
    mutationFn: (workOrder: WorkshopQueueWorkOrder) => api.pause(workOrder.id, workOrder.version),
    onSuccess: applyAuthoritative,
    onError: commandError,
  });
  const resume = useMutation({
    mutationFn: (workOrder: WorkshopQueueWorkOrder) => api.resume(workOrder.id, workOrder.version),
    onSuccess: applyAuthoritative,
    onError: commandError,
  });
  const complete = useMutation({
    mutationFn: (workOrder: WorkshopQueueWorkOrder) =>
      api.complete(workOrder.id, workOrder.version),
    onSuccess: applyAuthoritative,
    onError: commandError,
  });
  const cancel = useMutation({
    mutationFn: () => api.cancel(selected!.id, selected!.version, cancelReason.trim()),
    onSuccess: (workOrder) => {
      applyAuthoritative(workOrder);
      setCancelling(false);
      setCancelReason('');
      showToast({ variant: 'success', title: copy('Work Order cancelled.') });
    },
    onError: commandError,
  });

  const commandPending =
    pause.isPending || resume.isPending || complete.isPending || cancel.isPending;

  function runAction(workOrder: WorkshopQueueWorkOrder, action: WorkshopQueueAction) {
    if (action === 'pause') pause.mutate(workOrder);
    else if (action === 'resume') resume.mutate(workOrder);
    else if (action === 'complete') complete.mutate(workOrder);
    else if (action === 'cancel') setCancelling(true);
  }

  const ACTION_LABEL: Record<WorkshopQueueAction, string> = {
    pause: copy('Pause'),
    resume: copy('Resume'),
    complete: copy('Complete'),
    cancel: copy('Cancel work order'),
  };

  if (queue.isError)
    return (
      <div className="p-5 md:p-6 lg:p-8">
        <DConnectionError
          title={copy('Could not load the Workshop queue.')}
          message={copy('Check your connection, then try again.')}
          onRetry={() => void queue.refetch()}
        />
      </div>
    );

  const columns: TableColumn<WorkshopQueueWorkOrder>[] = [
    {
      key: 'workOrderNumber',
      label: copy('Work Order number'),
      render: (row) => <span className="font-semibold text-(--color-text)">{row.workOrderNumber}</span>,
    },
    {
      key: 'workStatus',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={STATUS_BADGE_VARIANT[row.workStatus]}>{label(row.workStatus)}</DBadge>
      ),
    },
    { key: 'customerNameSnapshot', label: copy('Customer') },
    { key: 'vehiclePlateSnapshot', label: copy('Vehicle') },
    {
      key: 'customerRequest',
      label: copy('Keluhan / Permintaan Customer'),
      render: (row) => <span className="line-clamp-1">{row.customerRequest}</span>,
    },
    {
      key: 'createdAt',
      label: copy('Created'),
      render: (row) => formatDate(new Date(row.createdAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
  ];

  const detail = selected;
  const detailActions = detail ? availableWorkshopQueueActions(detail.workStatus, permissions) : [];

  return (
    <div className="p-5 md:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
          {copy('Workshop')}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-(--color-text)">{copy('Queue')}</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          {copy('Work Orders at the active branch.')}
        </p>
      </header>

      {!selectedLocationId ? (
        <DAlert variant="warning" className="mt-5" title={copy('Select a Location to continue.')} />
      ) : null}

      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={queue.data?.items ?? []}
          loading={canRead && (queue.isLoading || !selectedLocationId)}
          rowKey="id"
          onRowClick={(row) => setSelected(row)}
          searchable
          searchPlaceholder={copy('Search by Work Order number')}
          searchValue={workOrderNumberQuery}
          onSearchChange={(value) => {
            setWorkOrderNumberQuery(value);
            setOffset(0);
          }}
          filters={
            <DSelect
              value={statusFilter}
              placeholder={copy('All statuses')}
              options={[
                { value: '', label: copy('All statuses') },
                ...(['WAITING', 'ASSIGNED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED'] as const).map(
                  (status) => ({ value: status, label: label(status) }),
                ),
              ]}
              onChange={(value) => {
                setStatusFilter((String(value ?? '') as WorkshopWorkOrderStatus) || '');
                setOffset(0);
              }}
            />
          }
          pagination={{
            page: Math.floor(offset / PAGE_SIZE) + 1,
            pageSize: PAGE_SIZE,
            total: queue.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
          emptyMessage={
            workOrderNumberQuery.trim() || statusFilter
              ? copy('No Work Orders match the current filters.')
              : copy('No Work Orders at this branch yet.')
          }
        />
      </section>

      <DDialog
        open={Boolean(detail)}
        onClose={closeDetail}
        title={detail ? detail.workOrderNumber : ''}
        className="w-full max-w-lg"
      >
        {detail ? (
          <div className="space-y-4">
            <DBadge variant={STATUS_BADGE_VARIANT[detail.workStatus]}>
              {label(detail.workStatus)}
            </DBadge>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-text-muted)">{copy('Customer')}</dt>
                <dd className="text-(--color-text)">{detail.customerNameSnapshot}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-text-muted)">{copy('Vehicle')}</dt>
                <dd className="text-(--color-text)">{detail.vehiclePlateSnapshot}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-text-muted)">{copy('Keluhan / Permintaan Customer')}</dt>
                <dd className="text-right text-(--color-text)">{detail.customerRequest}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-(--color-text-muted)">{copy('Created')}</dt>
                <dd className="text-(--color-text)">
                  {formatDate(new Date(detail.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                </dd>
              </div>
              {detail.workStatus === 'CANCELLED' && detail.cancellationReason ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-(--color-text-muted)">{copy('Reason')}</dt>
                  <dd className="text-right text-(--color-text)">{detail.cancellationReason}</dd>
                </div>
              ) : null}
            </dl>

            {isCancelling ? (
              <div className="space-y-3 rounded-lg border border-(--color-border) p-4">
                <DTextarea
                  label={copy('Reason')}
                  value={cancelReason}
                  onChange={setCancelReason}
                  placeholder={copy('For example, the customer changed their mind.')}
                />
                <div className="flex justify-end gap-2">
                  <DButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCancelling(false);
                      setCancelReason('');
                    }}
                  >
                    {copy('Back')}
                  </DButton>
                  <DButton
                    variant="danger"
                    size="sm"
                    loading={cancel.isPending}
                    disabled={!cancelReason.trim()}
                    onClick={() => cancel.mutate()}
                  >
                    {copy('Yes, cancel')}
                  </DButton>
                </div>
              </div>
            ) : detailActions.length ? (
              <div className="flex flex-wrap justify-end gap-2">
                {detailActions.map((action) => (
                  <DButton
                    key={action}
                    variant={action === 'cancel' ? 'danger' : 'secondary'}
                    size="sm"
                    loading={commandPending}
                    onClick={() => runAction(detail, action)}
                  >
                    {ACTION_LABEL[action]}
                  </DButton>
                ))}
              </div>
            ) : (
              <p className="text-sm text-(--color-text-muted)">
                {detail.workStatus === 'DONE' || detail.workStatus === 'CANCELLED'
                  ? copy('No more actions for this Work Order.')
                  : copy('You do not have permission to change this Work Order.')}
              </p>
            )}
          </div>
        ) : null}
      </DDialog>
    </div>
  );
}
