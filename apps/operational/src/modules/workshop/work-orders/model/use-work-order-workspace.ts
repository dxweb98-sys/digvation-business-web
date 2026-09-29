import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useToast } from '@digvation/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  liveQueryPolicy,
  QUEUE_REFRESH_INTERVAL_MS,
} from '../../../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { useOperationalSession } from '../../../operational/operational-session-provider';
import {
  WorkshopQueueApi,
  type WorkshopQueueWorkOrder,
  type WorkshopWorkOrderStatus,
} from '../api/workshop-queue-api';
import { canCreateWorkOrder, canReadWorkOrders } from './work-order-access';
import { useLocationBoundQueueState } from './workshop-queue-location-state';
import {
  WORKSHOP_KEEP_OPEN_ERROR_CODES,
  WORKSHOP_QUEUE_ERROR_COPY,
  type WorkshopQueueAction,
} from './workshop-queue-actions';

export const DEFAULT_PAGE_SIZE = 10;

export const WORK_ORDER_STATUS_FILTERS: readonly (WorkshopWorkOrderStatus | '')[] = [
  '',
  'WAITING',
  'ASSIGNED',
  'IN_PROGRESS',
  'PAUSED',
  'DONE',
  'CANCELLED',
];

function apiErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

function apiErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | undefined)?.status;
}

/**
 * List, filter, detail and lifecycle commands of the single Work Order
 * workspace. Runtime stays authoritative for every transition; this only
 * presents its answers.
 */
export function useWorkOrderWorkspace() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { selectedLocationId } = useOperationalSession();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Offset, the open detail and the cancellation form belong to the active
  // Operational location and reset when it changes; search and status filter
  // are page-level and are kept.
  const location = useLocationBoundQueueState(selectedLocationId);
  const { offset, setOffset, selected, setSelected, setCancelReason, setCancelling } = location;
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkshopWorkOrderStatus | ''>('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pickerOpen, setPickerOpen] = useState(false);

  const permissions = session.access.permissions;
  const canRead = canReadWorkOrders(permissions);
  const canCreate = canCreateWorkOrder(permissions);

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
    queryKey: ['workshop-queue', selectedLocationId, statusFilter, query, pageSize, offset],
    enabled: Boolean(selectedLocationId && canRead),
    queryFn: () =>
      api.list({
        limit: pageSize,
        offset,
        sellingLocationId: selectedLocationId!,
        q: query.trim() || undefined,
        status: statusFilter || undefined,
      }),
    ...liveQueryPolicy,
    placeholderData: keepPreviousData,
    refetchInterval: QUEUE_REFRESH_INTERVAL_MS,
  });

  // Candidates are read fresh each time the picker opens: availability changes
  // whenever another session starts or pauses work, and Runtime is the authority.
  const mechanics = useQuery({
    queryKey: ['workshop-mechanics', selectedLocationId],
    enabled: pickerOpen,
    queryFn: () => api.listMechanics(),
    staleTime: 0,
    gcTime: 0,
  });

  function openDetail(workOrder: WorkshopQueueWorkOrder) {
    setPickerOpen(false);
    setCancelling(false);
    setCancelReason('');
    setSelected(workOrder);
  }

  // Only request the close. The cancellation form is reset when the next Work
  // Order opens, so nothing collapses while the dialog is still fading out.
  function closeDetail() {
    setPickerOpen(false);
    setSelected(null);
  }

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
      // the same way. Close it; the refreshed list holds the current one.
      if (!WORKSHOP_KEEP_OPEN_ERROR_CODES.includes(code ?? '')) closeDetail();
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['workshop-mechanics'] });
      return;
    }
    showToast({
      variant: 'danger',
      title: copy('Could not update the Work Order. Try again.'),
    });
  }

  const start = useMutation({
    mutationFn: (workOrder: WorkshopQueueWorkOrder) => api.start(workOrder.id, workOrder.version),
    onSuccess: (workOrder) => {
      applyAuthoritative(workOrder);
      showToast({ variant: 'success', title: copy('Work Order started.') });
    },
    onError: commandError,
  });
  const assign = useMutation({
    mutationFn: (mechanicEmployeeId: string) =>
      api.assignMechanic(selected!.id, selected!.version, mechanicEmployeeId),
    onSuccess: (workOrder) => {
      const replaced = Boolean(selected?.mechanic);
      applyAuthoritative(workOrder);
      setPickerOpen(false);
      showToast({
        variant: 'success',
        title: copy(replaced ? 'Mechanic replaced.' : 'Mechanic assigned.'),
      });
    },
    onError: commandError,
  });
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
    mutationFn: () => api.cancel(selected!.id, selected!.version, location.cancelReason.trim()),
    onSuccess: (workOrder) => {
      applyAuthoritative(workOrder);
      setCancelling(false);
      setCancelReason('');
      showToast({ variant: 'success', title: copy('Work Order cancelled.') });
    },
    onError: commandError,
  });

  const commandPending =
    start.isPending ||
    pause.isPending ||
    resume.isPending ||
    complete.isPending ||
    cancel.isPending;

  function runAction(workOrder: WorkshopQueueWorkOrder, action: WorkshopQueueAction) {
    if (action === 'start') start.mutate(workOrder);
    else if (action === 'pause') pause.mutate(workOrder);
    else if (action === 'resume') resume.mutate(workOrder);
    else if (action === 'complete') complete.mutate(workOrder);
    else if (action === 'cancel') setCancelling(true);
  }

  return {
    selectedLocationId,
    permissions,
    canRead,
    canCreate,
    workOrders,
    query,
    changeQuery: (value: string) => {
      setQuery(value);
      setOffset(0);
    },
    statusFilter,
    changeStatusFilter: (value: WorkshopWorkOrderStatus | '') => {
      setStatusFilter(value);
      setOffset(0);
    },
    pageSize,
    changePageSize: (size: number) => {
      setPageSize(size);
      setOffset(0);
    },
    offset,
    changePage: (page: number) => setOffset((page - 1) * pageSize),
    selected,
    openDetail,
    closeDetail,
    isCancelling: location.isCancelling,
    cancelReason: location.cancelReason,
    setCancelReason,
    setCancelling,
    cancelPending: cancel.isPending,
    confirmCancel: () => cancel.mutate(),
    commandPending,
    runAction,
    mechanics,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    assignPending: assign.isPending,
    assignMechanic: (mechanicEmployeeId: string) => assign.mutate(mechanicEmployeeId),
  };
}
