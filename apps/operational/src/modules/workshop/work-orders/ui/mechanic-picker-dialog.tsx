import { cn, DAlert, DAvatar, DBadge, DButton, DDialog, DSkeleton } from '@digvation/ui';
import { Check, Clock, UserRoundCog, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  WorkshopMechanicAvailability,
  WorkshopMechanicCandidate,
} from '../api/workshop-queue-api';
import { SectionMark } from './section-identity';

const AVAILABILITY_VARIANT: Record<
  WorkshopMechanicAvailability,
  'success' | 'warning' | 'outline'
> = {
  AVAILABLE: 'success',
  BUSY: 'warning',
  INELIGIBLE: 'outline',
};

function MechanicOption({
  mechanic,
  selected,
  onSelect,
}: {
  mechanic: WorkshopMechanicCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const { copy, label } = useOperationalLocalization();
  const selectable = mechanic.availability === 'AVAILABLE';

  // Runtime stays the authority: a busy/unavailable mechanic is presented as
  // such and cannot be chosen, but the server still rejects it if state moved.
  const context =
    mechanic.availability === 'BUSY' && mechanic.activeWorkOrder
      ? `${copy('Working on')} ${mechanic.activeWorkOrder.workOrderNumber}`
      : mechanic.availability === 'INELIGIBLE'
        ? copy('Not enabled as a workshop mechanic.')
        : mechanic.openWorkOrderCount > 0
          ? `${mechanic.openWorkOrderCount} ${copy('open Work Orders')}`
          : copy('Waiting for work');

  const ContextIcon =
    mechanic.availability === 'BUSY'
      ? Wrench
      : mechanic.availability === 'AVAILABLE'
        ? Clock
        : null;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={!selectable}
      disabled={!selectable}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left outline-none transition-colors',
        'focus-visible:border-(--color-brand) focus-visible:ring-2 focus-visible:ring-(--color-brand)/20',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/8 shadow-md ring-2 ring-(--color-brand)/25'
          : 'border-(--color-border) bg-(--color-surface) shadow-sm hover:bg-(--color-surface-muted)',
        !selectable &&
          'cursor-not-allowed bg-(--color-surface-muted)/50 opacity-70 hover:bg-(--color-surface-muted)/50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border',
          selected
            ? 'border-(--color-brand) bg-(--color-brand) text-(--color-brand-foreground)'
            : 'border-(--color-border) bg-(--color-surface)',
          !selectable && 'opacity-50',
        )}
      >
        {selected ? <Check className="size-3.5" /> : null}
      </span>
      <DAvatar name={mechanic.displayName} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-(--color-text)">
          {mechanic.displayName}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-snug text-(--color-text-muted)">
          {ContextIcon ? <ContextIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          <span>{context}</span>
        </span>
      </span>
      <DBadge variant={AVAILABILITY_VARIANT[mechanic.availability]}>
        {label(mechanic.availability)}
      </DBadge>
    </button>
  );
}

/**
 * Focused picker for choosing or replacing the mechanic of one Work Order.
 * Availability is whatever Runtime answered when the picker opened; nothing is
 * predicted in the browser.
 */
export function MechanicPickerDialog({
  open,
  mode,
  currentEmployeeId,
  mechanics,
  loading,
  failed,
  pending,
  onRetry,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: 'assign' | 'replace';
  currentEmployeeId: string | null;
  mechanics: readonly WorkshopMechanicCandidate[] | undefined;
  loading: boolean;
  failed: boolean;
  pending: boolean;
  onRetry: () => void;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId(null);
  }, [open]);

  // Available mechanics first (stable within each group); Runtime's answer is not changed.
  const RANK: Record<WorkshopMechanicAvailability, number> = {
    AVAILABLE: 0,
    BUSY: 1,
    INELIGIBLE: 2,
  };
  const candidates = (mechanics ?? [])
    .filter((mechanic) => mechanic.employeeId !== currentEmployeeId)
    .map((mechanic, index) => ({ mechanic, index }))
    .sort(
      (left, right) =>
        RANK[left.mechanic.availability] - RANK[right.mechanic.availability] ||
        left.index - right.index,
    )
    .map(({ mechanic }) => mechanic);
  const title = mode === 'replace' ? copy('Replace mechanic') : copy('Assign mechanic');

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="md"
      className="[&>div:nth-child(2)]:shrink-0"
      ariaLabel={title}
      title={
        <span className="flex items-center gap-3">
          <SectionMark icon={UserRoundCog} tone="identity" />
          <span className="text-lg font-bold tracking-tight">{title}</span>
        </span>
      }
      description={copy('Choose the mechanic responsible for this Work Order.')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="outline" onClick={onClose} disabled={pending}>
            {copy('Cancel')}
          </DButton>
          <DButton
            loading={pending}
            disabled={!selectedId}
            onClick={() => selectedId && onConfirm(selectedId)}
          >
            {mode === 'replace' ? copy('Replace') : copy('Assign')}
          </DButton>
        </div>
      }
    >
      {failed ? (
        <div>
          <DAlert variant="danger" title={copy('Could not load mechanics.')} />
          <DButton variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            {copy('Retry')}
          </DButton>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true">
          <DSkeleton className="h-16 w-full" />
          <DSkeleton className="h-16 w-full" />
          <DSkeleton className="h-16 w-full" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-(--color-text-muted)">
          {copy('No mechanics yet. Enable mechanics from the Employee page in Backoffice.')}
        </p>
      ) : (
        <div role="radiogroup" aria-label={copy('Choose a mechanic')} className="space-y-2.5">
          {candidates.map((mechanic) => (
            <MechanicOption
              key={mechanic.employeeId}
              mechanic={mechanic}
              selected={selectedId === mechanic.employeeId}
              onSelect={() => setSelectedId(mechanic.employeeId)}
            />
          ))}
        </div>
      )}
    </DDialog>
  );
}
