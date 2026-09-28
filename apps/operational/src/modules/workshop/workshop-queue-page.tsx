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
  type WorkshopQueueAction,
} from './workshop-queue-actions';
import {
  WorkshopQueueApi,
  type WorkshopQueueWorkOrder,
  type WorkshopWorkOrderStatus,
} from './workshop-queue-api';

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<
  WorkshopWorkOrderStatus,
  'outline' | 'success' | 'warning' | 'danger' | 'info'
> = {
  WAITING: 'outline',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  PAUSED: 'outline',
  DONE: 'success',
  CANCELLED: 'danger',
};

function apiErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

function apiErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | undefined)?.status;
}

const ERROR_COPY: Record<string, string> = {
  WORKSHOP_WORK_STATUS_TRANSITION_INVALID:
    'This action is no longer available for the current Work Order status.',
  CANCELLATION_REASON_REQUIRED: 'Enter a reason to cancel this Work Order.',
};

export function WorkshopQueuePage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy, label, formatDate } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [offset, setOffset] = useState(0);
  const [workOrderNumberQuery, setWorkOrderNumberQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkshopWorkOrderStatus | ''>('');
  const [selected, setSelected] = useState<WorkshopQueueWorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setCancelling] = useState(false);

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
    setSelected(workOrder);
    void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
  }

  function commandError(error: unknown) {
    const status = apiErrorStatus(error);
    if (status === 409) {
      showToast({
        variant: 'danger',
        title: copy('This Work Order changed elsewhere. Reload and try again.'),
      });
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      return;
    }
    const code = apiErrorCode(error);
    showToast({
      variant: 'danger',
      title: copy(ERROR_COPY[code ?? ''] ?? 'Could not update the Work Order. Try again.'),
    });
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
    complete: copy('Mark complete'),
    cancel: copy('Cancel work order'),
  };

  if (queue.isError)
    return (
      <div className="p-5 md:p-6 lg:p-8">
        <DConnectionError
          title={copy('Could not load the Workshop queue.')}
          message={copy('Try loading the queue again.')}
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
          {copy('Work Orders waiting or in progress at the active location.')}
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
          emptyMessage={copy('No Work Orders match the current filters.')}
        />
      </section>

      <DDialog
        open={Boolean(detail)}
        onClose={() => {
          setSelected(null);
          setCancelling(false);
          setCancelReason('');
        }}
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
                  placeholder={copy('Explain why this Work Order is cancelled.')}
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
                    {copy('Confirm cancellation')}
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
                {copy('No further status changes are available.')}
              </p>
            )}
          </div>
        ) : null}
      </DDialog>
    </div>
  );
}
