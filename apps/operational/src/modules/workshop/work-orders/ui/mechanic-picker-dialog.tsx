import { cn, DAlert, DAvatar, DBadge, DButton, DDialog, DSkeleton } from '@digvation/ui';
import { useEffect, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  WorkshopMechanicAvailability,
  WorkshopMechanicCandidate,
} from '../api/workshop-queue-api';

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

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={!selectable}
      disabled={!selectable}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left outline-none transition-colors',
        'focus-visible:border-(--color-brand) focus-visible:ring-2 focus-visible:ring-(--color-brand)/20',
        selected
          ? 'border-(--color-brand) bg-(--color-brand)/5'
          : 'border-(--color-border) hover:bg-(--color-surface-muted)',
        !selectable && 'cursor-not-allowed opacity-60 hover:bg-transparent',
      )}
    >
      <DAvatar name={mechanic.displayName} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-(--color-text)">
          {mechanic.displayName}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-(--color-text-muted)">
          {context}
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

  const candidates = (mechanics ?? []).filter((mechanic) => mechanic.employeeId !== currentEmployeeId);
  const title = mode === 'replace' ? copy('Replace mechanic') : copy('Assign mechanic');

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="sm"
      ariaLabel={title}
      title={<span className="text-lg font-bold tracking-tight">{title}</span>}
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
        <div role="radiogroup" aria-label={copy('Choose a mechanic')} className="space-y-2">
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
