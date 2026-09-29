import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useToast } from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import {
  WorkshopLinesApi,
  type WorkshopLineSelectionInput,
  type WorkshopWorkOrderDetail,
} from '../api/workshop-lines-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { WORKSHOP_LINES_ERROR_COPY, WORKSHOP_LINES_STALE_CODES } from './work-order-lines-model';

const detailKey = (id: string) => ['workshop-work-order', id] as const;

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

/**
 * Accepted Lines of one Work Order and the one-time initial selection. The
 * Work Order detail read is the only source of accepted values; a Catalog
 * lookup here only feeds the picker and is never trusted on submit.
 */
export function useWorkOrderItems({
  workOrder,
  onAccepted,
  onStale,
}: {
  workOrder: WorkshopQueueWorkOrder;
  /** The authoritative Work Order returned by acceptance (new version included). */
  onAccepted: (workOrder: WorkshopWorkOrderDetail) => void;
  /** The open version is out of date; the workspace should reload from Runtime. */
  onStale: () => void;
}) {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidatesWanted, setCandidatesWanted] = useState(false);
  const currency = session.business.currency;
  const locationId = workOrder.sellingLocationId;

  const api = useMemo(
    () =>
      new WorkshopLinesApi(
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

  const detail = useQuery({
    queryKey: detailKey(workOrder.id),
    queryFn: () => api.getDetail(workOrder.id),
    staleTime: 0,
  });

  // Fresh on every open: Catalog prices and availability are Runtime's to answer.
  const catalog = useQuery({
    queryKey: ['workshop-item-catalog', locationId, currency],
    enabled: pickerOpen,
    queryFn: () => api.getCatalog(locationId, currency),
    staleTime: 0,
    gcTime: 0,
  });
  const candidates = useQuery({
    queryKey: ['workshop-additional-candidates', locationId, currency],
    enabled: pickerOpen && candidatesWanted,
    queryFn: () => api.getAdditionalItemCandidates(locationId, currency),
    staleTime: 0,
    gcTime: 0,
  });

  function closePicker() {
    setPickerOpen(false);
    setCandidatesWanted(false);
  }

  const accept = useMutation({
    mutationFn: (lines: WorkshopLineSelectionInput[]) =>
      api.acceptInitialLines(workOrder.id, workOrder.version, lines),
    onSuccess: (accepted) => {
      queryClient.setQueryData(detailKey(workOrder.id), accepted);
      void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
      closePicker();
      onAccepted(accepted);
      showToast({ variant: 'success', title: copy('Items saved.') });
    },
    onError: (error) => {
      const code = errorCode(error) ?? '';
      const known = WORKSHOP_LINES_ERROR_COPY[code];
      const stale = WORKSHOP_LINES_STALE_CODES.includes(code);
      showToast({
        variant: 'danger',
        title: copy(
          known ??
            (stale
              ? 'This Work Order was just changed. Open it again.'
              : 'Could not save the items. Try again.'),
        ),
      });
      if (stale) {
        closePicker();
        void queryClient.invalidateQueries({ queryKey: detailKey(workOrder.id) });
        onStale();
      } else if (known) {
        void catalog.refetch();
      }
    },
  });

  return {
    detail,
    catalog,
    candidates,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker,
    wantCandidates: () => setCandidatesWanted(true),
    accept: (lines: WorkshopLineSelectionInput[]) => accept.mutate(lines),
    acceptPending: accept.isPending,
  };
}
