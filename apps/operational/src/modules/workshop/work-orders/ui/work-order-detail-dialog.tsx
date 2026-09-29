import { DBadge, DButton, DDialog, DTextarea } from '@digvation/ui';
import { UserRoundPlus, UserRoundCog } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import {
  CustomerIdentity,
  CustomerMarker,
  IdentityBlock,
  VehicleIdentity,
  VehicleMarker,
} from '../../shared/ui/identity-blocks';
import { IconActionButton } from '../../shared/ui/icon-action-button';
import {
  availableWorkshopQueueActions,
  mechanicAssignmentMode,
  type WorkshopQueueAction,
} from '../model/workshop-queue-actions';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { STATUS_BADGE_VARIANT } from '../model/workshop-status-presentation';

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-(--color-text-muted)">{label}</p>
      <div className="mt-1 text-sm text-(--color-text)">{children}</div>
    </div>
  );
}

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
  const { copy, label, formatDate } = useOperationalLocalization();
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

  const footer = !shown ? null : isCancelling ? (
    <div className="flex justify-end gap-2">
      <DButton variant="outline" onClick={onCancelBack}>
        {copy('Back')}
      </DButton>
      <DButton
        variant="danger"
        loading={cancelPending}
        disabled={!cancelReason.trim()}
        onClick={onCancelConfirm}
      >
        {copy('Yes, cancel')}
      </DButton>
    </div>
  ) : actions.length ? (
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
    <DDialog
      open={Boolean(workOrder)}
      onClose={onClose}
      size="md"
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
        <div className="space-y-3">
          <IdentityBlock
            leading={<CustomerMarker name={shown.customerNameSnapshot} />}
            label={copy('Customer')}
          >
            <CustomerIdentity name={shown.customerNameSnapshot} phone={shown.customerPhoneSnapshot} />
          </IdentityBlock>

          <IdentityBlock leading={<VehicleMarker />} label={copy('Vehicle')}>
            <VehicleIdentity
              plate={shown.vehiclePlateSnapshot}
              chassis={shown.vehicleChassisNumberSnapshot}
              copy={copy}
            />
          </IdentityBlock>

          <IdentityBlock
            leading={
              shown.mechanic ? (
                <CustomerMarker name={shown.mechanic.displayName} />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--color-surface-muted) text-(--color-text-muted)">
                  <UserRoundPlus className="size-5" aria-hidden="true" />
                </span>
              )
            }
            label={copy('Mechanic')}
            {...(shown.mechanic && assignmentMode === 'replace'
              ? { replaceLabel: copy('Replace mechanic'), onReplace: onOpenMechanicPicker }
              : {})}
          >
            {shown.mechanic ? (
              <p className="truncate text-sm font-semibold text-(--color-text)">
                {shown.mechanic.displayName}
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-(--color-text-muted)">{copy('Not assigned yet')}</p>
                {assignmentMode ? (
                  <DButton variant="secondary" size="sm" onClick={onOpenMechanicPicker}>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRoundCog className="size-4" aria-hidden="true" />
                      {copy('Assign mechanic')}
                    </span>
                  </DButton>
                ) : null}
              </div>
            )}
          </IdentityBlock>

          {shownItemsSection ? (
            <div className="border-t border-(--color-border) pt-4">{shownItemsSection}</div>
          ) : null}

          {shownBillingSection ? (
            <div className="border-t border-(--color-border) pt-4">{shownBillingSection}</div>
          ) : null}

          <div className="space-y-4 border-t border-(--color-border) pt-4">
            <DetailField label={copy('Keluhan')}>
              <p className="whitespace-pre-wrap">{shown.customerRequest}</p>
            </DetailField>
            <DetailField label={copy('Created')}>
              {formatDate(new Date(shown.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
            </DetailField>
            {shown.workStatus === 'CANCELLED' && shown.cancellationReason ? (
              <DetailField label={copy('Reason')}>
                <p className="whitespace-pre-wrap">{shown.cancellationReason}</p>
              </DetailField>
            ) : null}
          </div>

          {isCancelling ? (
            <div className="border-t border-(--color-border) pt-4">
              <DTextarea
                label={copy('Reason')}
                value={cancelReason}
                onChange={onCancelReasonChange}
                placeholder={copy('For example, the customer changed their mind.')}
                clearable={false}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </DDialog>
  );
}
