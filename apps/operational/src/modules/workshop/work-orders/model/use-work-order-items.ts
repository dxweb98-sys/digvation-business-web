import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useToast } from '@digvation/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import {
  WorkshopLinesApi,
  type WorkshopLineAdjustmentInput,
  type WorkshopLineSelectionInput,
  type WorkshopWorkOrderDetail,
} from '../api/workshop-lines-api';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import {
  addDraftItems,
  buildAdjustmentInputs,
  EMPTY_ADJUSTMENT_DRAFT,
  type AdjustmentDraft,
} from './work-order-line-adjustment-model';
import {
  WORKSHOP_LINES_ERROR_COPY,
  WORKSHOP_LINES_STALE_CODES,
  type DraftLine,
} from './work-order-lines-model';

const detailKey = (id: string) => ['workshop-work-order', id] as const;

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string } | undefined)?.code;
}

/**
 * Effective items of one Work Order, the one-time initial selection and later
 * adjustments. The Work Order detail read is the only source of accepted
 * values; a Catalog lookup here only feeds the picker and is never trusted on
 * submit. Adjustments are staged in the browser and sent as one atomic set.
 */
export function useWorkOrderItems({
  workOrder,
  onAccepted,
  onStale,
}: {
  workOrder: WorkshopQueueWorkOrder;
  /** The authoritative Work Order returned by Runtime (new version included). */
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
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [draft, setDraft] = useState<AdjustmentDraft>(EMPTY_ADJUSTMENT_DRAFT);
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

  function closeAdjust() {
    setAdjustOpen(false);
    setDraft(EMPTY_ADJUSTMENT_DRAFT);
    closePicker();
  }

  function openAdjust({ addFirst = false }: { addFirst?: boolean } = {}) {
    setDraft(EMPTY_ADJUSTMENT_DRAFT);
    setAdjustOpen(true);
    if (addFirst) setPickerOpen(true);
  }

  function saved(result: WorkshopWorkOrderDetail, message: string) {
    queryClient.setQueryData(detailKey(workOrder.id), result);
    void queryClient.invalidateQueries({ queryKey: ['workshop-queue'] });
    closeAdjust();
    onAccepted(result);
    showToast({ variant: 'success', title: copy(message) });
  }

  function failed(error: unknown) {
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
      closeAdjust();
      void queryClient.invalidateQueries({ queryKey: detailKey(workOrder.id) });
      onStale();
    } else if (known && pickerOpen) {
      void catalog.refetch();
    }
  }

  const accept = useMutation({
    mutationFn: (lines: WorkshopLineSelectionInput[]) =>
      api.acceptInitialLines(workOrder.id, workOrder.version, lines),
    onSuccess: (accepted) => saved(accepted, 'Items saved.'),
    onError: failed,
  });

  const adjust = useMutation({
    mutationFn: (adjustments: WorkshopLineAdjustmentInput[]) =>
      api.adjustLines(workOrder.id, workOrder.version, adjustments),
    onSuccess: (adjusted) => saved(adjusted, 'Items updated.'),
    onError: failed,
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
    adjustOpen,
    openAdjust,
    closeAdjust,
    draft,
    changeDraft: setDraft,
    /** Picker result while adjusting: staged in the draft, saved only with the whole set. */
    stageAdded: (items: readonly DraftLine[]) => {
      setDraft((current) => addDraftItems(current, items));
      closePicker();
    },
    saveAdjustment: (lines: Parameters<typeof buildAdjustmentInputs>[0]) =>
      adjust.mutate(buildAdjustmentInputs(lines, draft)),
    adjustPending: adjust.isPending,
  };
}
