import { DButton } from '@digvation/ui';
import {
  CalendarClock,
  CarFront,
  ClipboardList,
  FileText,
  Hash,
  Phone,
  RefreshCcw,
  User,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { IconActionButton } from '../../shared/ui/icon-action-button';
import { formatPhoneForDisplay } from '../../shared/model/format-phone';
import type { WorkshopQueueWorkOrder } from '../api/workshop-queue-api';
import { SectionHeader, SectionMark, SURFACE_RAISED } from './section-identity';

/**
 * One identity anchor (customer, vehicle, mechanic): a marker tile, a small
 * category label, then the strong primary value. Anything the user can do to
 * this identity sits on the same row as its label, so the action belongs to
 * the category and never floats.
 */
function IdentityRow({
  icon,
  label,
  action,
  pending = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  action?: ReactNode;
  /** The identity is still missing: drawn as an open slot instead of a value. */
  pending?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 ${
        pending ? 'bg-(--color-warning)/[0.07]' : ''
      }`}
    >
      {pending ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-dashed border-(--color-warning)/60 bg-(--color-surface) text-(--color-warning)">
          <UserRoundCog className="size-5" aria-hidden="true" />
        </span>
      ) : (
        <SectionMark icon={icon} tone="identity" className="size-10 rounded-xl" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-(--color-text-muted)">{label}</p>
          {action ? <span className="-mr-2">{action}</span> : null}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/** Customer, Vehicle and Mechanic: the identity of the job, as one raised card. */
export function WorkOrderPeoplePanel({
  workOrder,
  assignmentMode,
  onOpenMechanicPicker,
}: {
  workOrder: WorkshopQueueWorkOrder;
  assignmentMode: 'assign' | 'replace' | null;
  onOpenMechanicPicker: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const { mechanic } = workOrder;
  return (
    <section
      aria-label={copy('Work Order information')}
      className={`overflow-hidden rounded-2xl max-lg:order-1 ${SURFACE_RAISED}`}
    >
      <SectionHeader
        icon={ClipboardList}
        tone="identity"
        title={copy('Work Order information')}
        className="border-b border-(--color-border) bg-(--color-brand)/[0.05]"
      />
      <div className="divide-y divide-(--color-border)">
        <IdentityRow icon={User} label={copy('Customer')}>
          <p className="truncate text-[15px] font-semibold text-(--color-text)">
            {workOrder.customerNameSnapshot}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-(--color-text-muted)">
            <Phone className="size-3 shrink-0" aria-hidden="true" />
            {formatPhoneForDisplay(workOrder.customerPhoneSnapshot)}
          </p>
        </IdentityRow>

        <IdentityRow icon={CarFront} label={copy('Vehicle')}>
          <p className="inline-block max-w-full truncate rounded-md border-2 border-(--color-text) bg-(--color-surface) px-2 py-0.5 text-base font-bold tracking-widest text-(--color-text)">
            {workOrder.vehiclePlateSnapshot}
          </p>
          <p className="mt-1.5 flex items-center gap-1 truncate text-[13px] text-(--color-text-muted)">
            <Hash className="size-3 shrink-0" aria-hidden="true" />
            {copy('Chassis number')}
          </p>
          <p className="truncate text-[13px] text-(--color-text)">
            {workOrder.vehicleChassisNumberSnapshot}
          </p>
        </IdentityRow>

        <IdentityRow
          icon={UserRoundCog}
          label={copy('Mechanic')}
          pending={!mechanic}
          action={
            mechanic && assignmentMode === 'replace' ? (
              <IconActionButton
                tooltip={false}
                icon={RefreshCcw}
                label={copy('Replace mechanic')}
                onClick={onOpenMechanicPicker}
              />
            ) : null
          }
        >
          {mechanic ? (
            <p className="truncate text-[15px] font-semibold text-(--color-text)">
              {mechanic.displayName}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="text-[15px] font-semibold text-(--color-text)">
                {copy('Not assigned yet')}
              </p>
              {assignmentMode ? (
                <DButton variant="primary" size="sm" onClick={onOpenMechanicPicker}>
                  {copy('Assign mechanic')}
                </DButton>
              ) : null}
            </div>
          )}
        </IdentityRow>
      </div>
    </section>
  );
}

/** Complaint and record metadata: the secondary details of the Work Order. */
export function WorkOrderNotesPanel({ workOrder }: { workOrder: WorkshopQueueWorkOrder }) {
  const { copy, formatDate } = useOperationalLocalization();
  return (
    <section
      aria-label={copy('Details')}
      className={`overflow-hidden rounded-2xl max-lg:order-4 ${SURFACE_RAISED}`}
    >
      <SectionHeader
        icon={FileText}
        tone="identity"
        title={copy('Details')}
        className="border-b border-(--color-border) bg-(--color-brand)/[0.05]"
      />
      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-[12px] font-semibold text-(--color-text-muted)">{copy('Keluhan')}</p>
          <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-(--color-brand)/40 pl-3 text-sm leading-relaxed text-(--color-text)">
            {workOrder.customerRequest}
          </p>
        </div>
        {workOrder.workStatus === 'CANCELLED' && workOrder.cancellationReason ? (
          <div>
            <p className="text-[12px] font-semibold text-(--color-danger)">{copy('Reason')}</p>
            <p className="mt-1.5 whitespace-pre-wrap border-l-2 border-(--color-danger)/50 pl-3 text-sm leading-relaxed text-(--color-text)">
              {workOrder.cancellationReason}
            </p>
          </div>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-(--color-text-muted)">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{copy('Created')}</span>
          <time dateTime={workOrder.createdAt} className="text-(--color-text)">
            {formatDate(new Date(workOrder.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </p>
      </div>
    </section>
  );
}
