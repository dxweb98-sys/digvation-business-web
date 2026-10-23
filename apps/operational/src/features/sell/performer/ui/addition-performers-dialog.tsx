import { DAlert, DButton, DDialog, DRadio } from '@digvation/ui';
import { useEffect, useEffectEvent, useState } from 'react';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type {
  Employee,
  SaleComponentPerformerAssignment,
} from '../../transaction/model/cashier-transaction.types';
import type { AdditionPerformersDecision } from '../../transaction/api/cashier-transaction.adapter';
import {
  allocationFromRates,
  allocationRates,
  resolveAllocation,
  type PerformerAllocation,
} from '../model/service-performer-allocation';
import { EmployeeChoices, issueCopy, WorkSplit } from './service-performers-dialog';

const CHOICES = [
  { value: 'SERVICE', label: 'Same as main service' },
  { value: 'OWN', label: 'Choose other employees' },
] as const;

/**
 * Who performs ONE selected addition of a Service: the main Service performers (its work is then
 * part of the Service, whoever performs that when the work completes), or employees chosen for it
 * with their shares. Choosing other employees may name a main Service performer too. Opened from
 * the addition's card in the transaction detail; never a salesperson or a commission.
 */
export function AdditionPerformersDialog({
  additionName,
  assignment,
  performers,
  serviceNames,
  employees,
  isSaving,
  onClose,
  onSave,
}: {
  additionName: string;
  /** The persisted decision; null while it has not been made. */
  assignment: SaleComponentPerformerAssignment | null;
  /** Its own performers with their persisted shares. */
  performers: ReadonlyArray<{ employeeId: string; shareRate: string }>;
  /** Who performs the main Service now; empty when nobody is assigned yet. */
  serviceNames: readonly string[];
  employees: readonly Employee[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: AdditionPerformersDecision) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [choice, setChoice] = useState<SaleComponentPerformerAssignment | null>(
    assignment ?? (performers.length ? 'OWN' : null),
  );
  const [allocation, setAllocation] = useState<PerformerAllocation>(() =>
    allocationFromRates(performers),
  );
  const [error, setError] = useState<string | null>(null);
  const nameOf = (employeeId: string) =>
    employees.find((employee) => employee.id === employeeId)?.displayName ??
    copy('Employee unavailable');

  // This dialog opens above the transaction detail; Escape closes only this layer.
  const onEscape = useEffectEvent(() => {
    if (!isSaving) onClose();
  });
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="option"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const save = () => {
    if (!choice) {
      setError(copy('Choose who performs it.'));
      return;
    }
    if (choice === 'SERVICE') {
      onSave({ assignment: 'SERVICE' });
      return;
    }
    const issue = resolveAllocation(allocation).issue;
    if (issue) {
      setError(
        issue === 'EMPTY'
          ? copy('Choose at least one employee, or use the main service performers.')
          : copy(issueCopy[issue]),
      );
      return;
    }
    onSave({ assignment: 'OWN', performers: allocationRates(allocation) });
  };

  const sharing = choice === 'OWN' && resolveAllocation(allocation).shares.length >= 2;

  return (
    <DDialog
      open
      title={copy('Who performs this additional item?')}
      description={additionName}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      ariaLabel={copy('Who performs this additional item?')}
      closeOnEscape={false}
      size="md"
      className="pos-reference-dialog w-full overflow-hidden"
      footer={
        // Allocation on the left, confirmation on the right; on a phone they stack as two rows.
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {sharing ? (
            <WorkSplit
              allocation={allocation}
              disabled={isSaving}
              onChange={(next) => {
                setError(null);
                setAllocation(next);
              }}
            />
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <DButton variant="ghost" disabled={isSaving} onClick={onClose}>
              {copy('Cancel')}
            </DButton>
            <DButton loading={isSaving} disabled={isSaving} onClick={save}>
              {copy('Save')}
            </DButton>
          </div>
        </div>
      }
    >
      <div className="space-y-3 leading-normal text-[var(--color-text)]">
        {error ? <DAlert variant="danger">{error}</DAlert> : null}
        <fieldset className="min-w-0">
          <legend className="sr-only">{copy('Performed by')}</legend>
          <div className="grid overflow-hidden rounded-lg border border-[var(--color-border)] max-sm:divide-y sm:grid-cols-2 sm:divide-x divide-[var(--color-border)]">
            {CHOICES.map((option) => (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  choice === option.value
                    ? 'bg-[var(--color-brand)]/[.07] font-semibold text-[var(--color-text)]'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <DRadio
                  name="addition-performer-choice"
                  checked={choice === option.value}
                  disabled={isSaving}
                  onChange={() => {
                    setError(null);
                    setChoice(option.value);
                  }}
                />
                <span className="min-w-0 break-words">{copy(option.label)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {choice === 'SERVICE' ? (
          <p
            className={`text-sm ${
              serviceNames.length
                ? 'text-[var(--color-text-muted)]'
                : 'font-medium text-[var(--color-warning)]'
            }`}
          >
            {serviceNames.length
              ? `${copy('Done by whoever performs the main service.')} ${copy('Currently')}: ${serviceNames.join(', ')}`
              : copy('Main service performer not chosen yet')}
          </p>
        ) : null}
        {choice === 'OWN' ? (
          <EmployeeChoices
            allocation={allocation}
            employees={employees}
            nameOf={nameOf}
            disabled={isSaving}
            onChange={(next) => {
              setError(null);
              setAllocation(next);
            }}
          />
        ) : null}
      </div>
    </DDialog>
  );
}
