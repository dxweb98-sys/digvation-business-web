import { DBadge, DButton, DDialog } from '@digvation/ui';
import { useRef, type ReactNode } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { CancelWorkOrderDialog } from './cancel-work-order-dialog';
import { WorkOrderNotesPanel, WorkOrderPeoplePanel } from './work-order-context-panels';
import {
  availableWorkshopQueueActions,
  mechanicAssignmentMode,
  type WorkshopQueueAction,
} from '../model/workshop-queue-actions';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { STATUS_BADGE_VARIANT } from '../model/workshop-status-presentation';

/**
 * Work Order detail for the Queue. `workOrder` is null while the dialog is
 * closed; the last non-null Work Order keeps rendering until DDialog has
 * finished its close transition, so nothing flashes or collapses on close.
 */
export function WorkOrderDetailDialog({
  workOrder,
  permissions,
  isCancelling,
  cancelReason,
  cancelPending,
  commandPending,
  onClose,
  onAction,
  onOpenMechanicPicker,
  itemsSection,
  billingSection,
  onCancelReasonChange,
  onCancelBack,
  onCancelConfirm,
}: {
  workOrder: WorkshopQueueWorkOrder | null;
  permissions: readonly string[];
  isCancelling: boolean;
  cancelReason: string;
  cancelPending: boolean;
  commandPending: boolean;
  onClose: () => void;
  onAction: (workOrder: WorkshopQueueWorkOrder, action: WorkshopQueueAction) => void;
  onOpenMechanicPicker: () => void;
  /** Accepted Work Order items; rendered by the workspace, which owns their data. */
  itemsSection?: ReactNode;
  /** Billing summary of the open Work Order; a consequence of its items. */
  billingSection?: ReactNode;
  onCancelReasonChange: (value: string) => void;
  onCancelBack: () => void;
  onCancelConfirm: () => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const lastWorkOrder = useRef(workOrder);
  if (workOrder) lastWorkOrder.current = workOrder;
  const shown = workOrder ?? lastWorkOrder.current;
  // The items section is kept for the close transition for the same reason.
  const lastItemsSection = useRef(itemsSection);
  if (workOrder) lastItemsSection.current = itemsSection;
  const shownItemsSection = workOrder ? itemsSection : lastItemsSection.current;
  const lastBillingSection = useRef(billingSection);
  if (workOrder) lastBillingSection.current = billingSection;
  const shownBillingSection = workOrder ? billingSection : lastBillingSection.current;

  const actions = shown ? availableWorkshopQueueActions(shown.workStatus, permissions) : [];
  const cancelAction = actions.includes('cancel');
  const lifecycleActions = actions.filter((action) => action !== 'cancel');

  const assignmentMode = shown ? mechanicAssignmentMode(shown.workStatus, permissions) : null;

  const actionLabel: Record<WorkshopQueueAction, string> = {
    start: copy('Start'),
    pause: copy('Pause'),
    resume: copy('Resume'),
    complete: copy('Complete'),
    cancel: copy('Cancel work order'),
  };

  const footer = !shown ? null : actions.length ? (
    <div className="flex items-center justify-between gap-2">
      <div>
        {cancelAction ? (
          <DButton
            variant="danger"
            loading={commandPending}
            onClick={() => onAction(shown, 'cancel')}
          >
            {actionLabel.cancel}
          </DButton>
        ) : null}
      </div>
      <div className="flex gap-2">
        {lifecycleActions.map((action) => (
          <DButton
            key={action}
            variant={action === 'complete' || action === 'start' ? 'primary' : 'secondary'}
            loading={commandPending}
            onClick={() => onAction(shown, action)}
          >
            {actionLabel[action]}
          </DButton>
        ))}
      </div>
    </div>
  ) : (
    <p className="text-sm text-(--color-text-muted)">
      {shown.workStatus === 'DONE' || shown.workStatus === 'CANCELLED'
        ? copy('No more actions for this Work Order.')
        : copy('You do not have permission to change this Work Order.')}
    </p>
  );

  return (
    <>
      <DDialog
        open={Boolean(workOrder)}
        onClose={onClose}
        size="xl"
        noPadding
        className="lg:h-[min(46rem,85vh)]"
        ariaLabel={shown?.workOrderNumber ?? copy('Queue')}
        title={
          shown ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight">{shown.workOrderNumber}</span>
              <DBadge variant={STATUS_BADGE_VARIANT[shown.workStatus]}>
                {label(shown.workStatus)}
              </DBadge>
            </span>
          ) : (
            ''
          )
        }
        footer={footer}
      >
        {shown ? (
          /* Desktop is a fixed-height workspace: the left column (context above,
           billing pinned at its bottom) never moves, and only the item list scrolls.
           Below lg everything reads in one natural column: people, items, billing,
           then the complaint; `contents` + `max-lg:order-*` re-orders without a
           second copy of any section. */
          <div className="grid gap-4 bg-(--color-surface-muted)/45 px-5 py-4 lg:h-full lg:grid-cols-[minmax(0,36fr)_minmax(0,64fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
            {/* LEFT: Work Order context only. */}
            <div
              data-region="context"
              className="max-lg:contents lg:min-h-0 lg:space-y-4 lg:overflow-y-auto lg:px-1 lg:py-1"
            >
              <WorkOrderPeoplePanel
                workOrder={shown}
                assignmentMode={assignmentMode}
                onOpenMechanicPicker={onOpenMechanicPicker}
              />
              <WorkOrderNotesPanel workOrder={shown} />
            </div>

            {/* RIGHT: the operational workspace. The item list is the only region that
              scrolls on desktop; the billing derived from it stays anchored below. */}
            <div
              data-region="work"
              className="flex min-w-0 flex-col gap-4 max-lg:order-2 lg:min-h-0"
            >
              {shownItemsSection}
              {shownBillingSection ? <div className="shrink-0">{shownBillingSection}</div> : null}
            </div>
          </div>
        ) : null}
      </DDialog>
      <CancelWorkOrderDialog
        open={isCancelling && Boolean(workOrder)}
        workOrderNumber={shown?.workOrderNumber ?? ''}
        reason={cancelReason}
        pending={cancelPending}
        onReasonChange={onCancelReasonChange}
        onBack={onCancelBack}
        onConfirm={onCancelConfirm}
      />
    </>
  );
}
