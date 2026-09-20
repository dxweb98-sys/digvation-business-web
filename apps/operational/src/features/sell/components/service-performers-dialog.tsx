import { createDecimal } from '@digvation/pos-money';
import { DButton, DCheckbox, DConfirmDialog, DDialog, DInput, DSelect } from '@digvation-labs/ui';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { Employee, Sale, SaleLine } from '../cashier-transaction.types';
import { employeeDisplayName } from '../sale-presentation';
import {
  allocationFromRates,
  allocationRates,
  cloneAllocation,
  emptyAllocation,
  evenAllocation,
  formatPercent,
  parsePercent,
  resolveAllocation,
  sameAllocation,
  withEmployees,
  withShare,
  type AllocationIssue,
  type PerformerAllocation,
  type ResolvedShare,
  type ServiceLineWorkPlan,
} from '../service-performer-allocation';

/** Whole-number quantity of a service line; each unit is one separately performed service. */
export function serviceWorkUnitCount(line: SaleLine): number {
  try {
    const quantity = createDecimal(line.quantity);
    if (!quantity.isInteger() || quantity.lessThan(createDecimal('1'))) return 1;
    const count = quantity.toNumber();
    return Number.isSafeInteger(count) && count <= 100 ? count : 1;
  } catch {
    return 1;
  }
}

function assignedParticipations(line: SaleLine) {
  return line.participations.filter(
    (participation) => participation.assigned || participation.shareRate !== null,
  );
}

/** Employees and contribution shares of each unit, as persisted by Runtime. */
export function serviceWorkUnitAllocations(line: SaleLine): PerformerAllocation[] {
  const count = serviceWorkUnitCount(line);
  const stored = new Map(
    (line.workUnits ?? []).map((unit) => [
      unit.unitNumber,
      unit.performers ?? unit.employeeIds.map((employeeId) => ({ employeeId, shareRate: null })),
    ]),
  );
  const lineLevel = stored.size ? [] : assignedParticipations(line);
  return [...Array(count).keys()].map((index) =>
    allocationFromRates(stored.get(index + 1) ?? lineLevel),
  );
}

/** A tracked service whose performers Operational may still change. */
const editableService = (line: SaleLine) =>
  line.removedAt === null &&
  line.itemTypeSnapshot === 'SERVICE' &&
  line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
  (line.employeeAssignmentModeSnapshot !== 'NONE' || line.allowEmployeeContributionSnapshot) &&
  (line.fulfillment?.status === 'WAITING' || line.fulfillment?.status === 'IN_PROGRESS');

interface ServiceTarget {
  key: string;
  lineId: string;
  name: string;
}

function lineName(line: SaleLine) {
  return line.variantNameSnapshot
    ? `${line.itemNameSnapshot} (${line.variantNameSnapshot})`
    : line.itemNameSnapshot;
}

/** Every performed service of the sale: one per unit of each editable service line. */
function serviceTargets(sale: Sale): ServiceTarget[] {
  return sale.lines.filter(editableService).flatMap((line) => {
    const count = serviceWorkUnitCount(line);
    return [...Array(count).keys()].map((index) => ({
      key: `${line.id}:${index}`,
      lineId: line.id,
      name: count > 1 ? `${lineName(line)} · ${index + 1}/${count}` : lineName(line),
    }));
  });
}

function initialAllocations(sale: Sale): Record<string, PerformerAllocation> {
  return Object.fromEntries(
    sale.lines
      .filter(editableService)
      .flatMap((line) =>
        serviceWorkUnitAllocations(line).map((allocation, index) => [
          `${line.id}:${index}`,
          allocation,
        ]),
      ),
  );
}

const issueCopy: Record<Exclude<AllocationIssue, null>, string> = {
  EMPTY: 'Select at least one employee.',
  OVER: 'Percentages exceed 100%. Lower one of them.',
  UNDER: 'Percentages must total 100%.',
};

/** Employees as a tick list in directory order; search appears only for long lists. */
function EmployeeChecklist({
  legend,
  employees,
  selected,
  disabled,
  onChange,
}: {
  legend: string;
  employees: readonly Employee[];
  selected: readonly string[];
  disabled: boolean;
  onChange: (employeeIds: string[]) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [query, setQuery] = useState('');
  const searchable = employees.length > 8;
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? employees.filter((employee) =>
          `${employee.displayName} ${employee.code}`.toLocaleLowerCase().includes(needle),
        )
      : employees;
  }, [employees, query]);

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-[var(--color-text)]">
        <span>{legend}</span>
        <span className="text-xs font-normal text-[var(--color-text-muted)]">
          {selected.length} {copy('employees selected')}
        </span>
      </legend>
      {searchable ? (
        <div className="relative mb-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <DInput
            aria-label={copy('Search employee')}
            value={query}
            onChange={setQuery}
            placeholder={copy('Search employee')}
            className="pl-9"
          />
        </div>
      ) : null}
      <ul className="max-h-[min(15rem,34dvh)] divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-control)] border border-[var(--color-border)]">
        {visible.map((employee) => {
          const checked = selected.includes(employee.id);
          return (
            <li key={employee.id}>
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  checked
                    ? 'bg-[var(--color-brand)]/[.06]'
                    : 'hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <DCheckbox
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== employee.id)
                        : [...selected, employee.id],
                    )
                  }
                />
                <span className="min-w-0 flex-1 break-words font-medium">
                  {employee.displayName}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {employee.code}
                </span>
              </label>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
            {copy('No employee matches this search.')}
          </li>
        ) : null}
      </ul>
    </fieldset>
  );
}

/** A share field: typed values are kept, the others show the automatic remainder. */
function ShareInput({
  share,
  label,
  disabled,
  onCommit,
}: {
  share: ResolvedShare;
  label: string;
  disabled: boolean;
  onCommit: (basisPoints: number | null) => void;
}) {
  const { locale } = useOperationalLocalization();
  const [draft, setDraft] = useState<string | null>(null);
  const unreadable = draft !== null && draft.trim() !== '' && parsePercent(draft) === null;
  return (
    <DInput
      aria-label={label}
      aria-invalid={unreadable || undefined}
      value={draft ?? formatPercent(share.basisPoints, locale)}
      disabled={disabled}
      clearable={false}
      inputMode="decimal"
      onFocus={(event) => {
        setDraft(formatPercent(share.basisPoints, locale));
        event.currentTarget.select();
      }}
      onBlur={() => setDraft(null)}
      onChange={(value) => {
        setDraft(value);
        if (!value.trim()) {
          onCommit(null);
          return;
        }
        const basisPoints = parsePercent(value);
        if (basisPoints !== null) onCommit(basisPoints);
      }}
      size="sm"
      containerClassName="w-20 shrink-0"
      className={`text-right tabular-nums ${
        share.manual ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
      } ${unreadable ? 'border-[var(--color-danger)]' : ''}`}
    />
  );
}

/** How much of one service each selected employee performed; always resolves to 100%. */
function WorkSplit({
  allocation,
  nameOf,
  disabled,
  onChange,
}: {
  allocation: PerformerAllocation;
  nameOf: (employeeId: string) => string;
  disabled: boolean;
  onChange: (allocation: PerformerAllocation) => void;
}) {
  const { copy, locale } = useOperationalLocalization();
  const { shares, total, issue } = resolveAllocation(allocation);
  if (!shares.length) return null;
  const several = shares.length > 1;
  const typed = shares.some((share) => share.manual);
  return (
    <section
      aria-label={copy('Work split')}
      className="space-y-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 p-3"
    >
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{copy('Work split')}</h3>
        {several ? (
          <DButton
            size="sm"
            variant="ghost"
            disabled={disabled || !typed}
            onClick={() => onChange(evenAllocation(allocation))}
            className="h-8 px-2.5 text-xs"
          >
            {copy('Split evenly')}
          </DButton>
        ) : null}
      </div>
      {several ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          {copy('Change one percentage; the rest is shared automatically.')}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {shares.map((share) => (
          <li key={share.employeeId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{nameOf(share.employeeId)}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              {several && !share.manual ? (
                <span className="text-[11px] text-[var(--color-text-muted)]">{copy('auto')}</span>
              ) : null}
              {several ? (
                <ShareInput
                  share={share}
                  label={`${copy('Share (%)')} ${nameOf(share.employeeId)}`}
                  disabled={disabled}
                  onCommit={(basisPoints) =>
                    onChange(withShare(allocation, share.employeeId, basisPoints))
                  }
                />
              ) : (
                <span className="w-20 text-right font-semibold tabular-nums">
                  {formatPercent(share.basisPoints, locale)}
                </span>
              )}
              <span className="text-[var(--color-text-muted)]">%</span>
            </span>
          </li>
        ))}
      </ul>
      <div
        className={`flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-2 text-sm font-semibold ${
          issue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
        }`}
      >
        <span>{copy('Total')}</span>
        <span className="tabular-nums">{formatPercent(total, locale)}%</span>
      </div>
      {issue && issue !== 'EMPTY' ? (
        <p className="text-xs font-medium text-[var(--color-danger)]">{copy(issueCopy[issue])}</p>
      ) : null}
    </section>
  );
}

/**
 * Chooses who performs the services of a sale and how much of each service
 * each employee contributed. One shared setting applies to every service, or
 * each service (one per unit of quantity) gets its own. Shares attribute work
 * only; they never change sale amounts.
 */
export function ServicePerformersDialog({
  sale,
  lineId,
  employees,
  isSaving,
  onClose,
  onSave,
}: {
  sale: Sale;
  lineId: string;
  employees: readonly Employee[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (plans: ServiceLineWorkPlan[]) => void;
}) {
  const { copy } = useOperationalLocalization();
  const [targets] = useState(() => serviceTargets(sale));
  const [initial] = useState(() => initialAllocations(sale));
  const firstKey = targets.find((target) => target.lineId === lineId)?.key ?? targets[0]?.key ?? '';
  const [activeKey, setActiveKey] = useState(firstKey);
  const [allocations, setAllocations] = useState(initial);
  const uniform = targets.every((target) =>
    sameAllocation(initial[target.key]!, initial[targets[0]!.key]!),
  );
  const [perService, setPerService] = useState(() => targets.length > 1 && !uniform);
  const [shared, setShared] = useState(() =>
    cloneAllocation(initial[firstKey] ?? emptyAllocation()),
  );
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const multiple = targets.length > 1;
  const planOf = (key: string) => (perService ? allocations[key]! : shared);
  const dirty = targets.some((target) => !sameAllocation(planOf(target.key), initial[target.key]!));
  const nameOf = (employeeId: string) => {
    const line =
      sale.lines.find((candidate) =>
        candidate.participations.some((participation) => participation.employeeId === employeeId),
      ) ?? sale.lines[0]!;
    return employeeDisplayName(line, employeeId, employees, copy('Employee unavailable'));
  };
  const activeIndex = Math.max(
    0,
    targets.findIndex((target) => target.key === activeKey),
  );
  const active = perService ? allocations[activeKey]! : shared;
  const setActive = (next: PerformerAllocation) => {
    setError(null);
    if (perService) setAllocations((current) => ({ ...current, [activeKey]: next }));
    else setShared(next);
  };

  const statusOf = (key: string) => {
    const { shares, issue } = resolveAllocation(allocations[key]!);
    if (issue === 'EMPTY') return { ok: false, text: copy('No employee yet') };
    if (issue) return { ok: false, text: copy('Check the percentages') };
    return { ok: true, text: `${shares.length} ${copy('employees')}` };
  };
  const readyCount = targets.filter((target) => statusOf(target.key).ok).length;

  // Unsaved choices are never dropped silently: Cancel, X, Escape and the
  // backdrop all ask first, in the app's own dialog.
  const close = () => {
    if (isSaving) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  // This editor opens above the transaction detail dialog, and every open
  // dialog listens for Escape. Handling it first keeps Escape scoped to the
  // topmost layer: it asks before discarding, and on the confirmation it
  // means "keep editing".
  const onEscape = useEffectEvent(() => {
    if (confirmDiscard) setConfirmDiscard(false);
    else close();
  });
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // An open dropdown inside the editor closes itself first.
      if (event.key !== 'Escape' || document.querySelector('[role="option"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const chooseMode = (next: boolean) => {
    setError(null);
    if (next === perService) return;
    if (next) {
      // The shared setting is the starting point for every service.
      setAllocations(
        Object.fromEntries(targets.map((target) => [target.key, cloneAllocation(shared)])),
      );
      setPerService(true);
      return;
    }
    const differs = targets.some(
      (target) => !sameAllocation(allocations[target.key]!, allocations[activeKey]!),
    );
    if (differs) {
      setConfirmReplace(true);
      return;
    }
    setShared(cloneAllocation(allocations[activeKey]!));
    setPerService(false);
  };

  const save = () => {
    setError(null);
    const invalid = targets.find((target) => resolveAllocation(planOf(target.key)).issue);
    if (invalid) {
      const { issue } = resolveAllocation(planOf(invalid.key));
      if (perService) setActiveKey(invalid.key);
      setError(
        perService ? `${invalid.name}: ${copy(issueCopy[issue!])}` : copy(issueCopy[issue!]),
      );
      return;
    }
    const changedLines = new Set(
      targets
        .filter((target) => !sameAllocation(planOf(target.key), initial[target.key]!))
        .map((target) => target.lineId),
    );
    if (!changedLines.size) {
      onClose();
      return;
    }
    onSave(
      [...changedLines].map((changedLineId) => ({
        lineId: changedLineId,
        units: targets
          .filter((target) => target.lineId === changedLineId)
          .map((target) => allocationRates(planOf(target.key))),
      })),
    );
  };

  const serviceOptions = targets.map((target) => ({
    value: target.key,
    label: `${target.name} · ${statusOf(target.key).text}`,
  }));
  const activeStatus = perService ? statusOf(activeKey) : null;

  return (
    <DDialog
      open
      title={copy('Who is doing this service?')}
      description={
        multiple
          ? `${targets.length} ${copy('services')}`
          : (targets[0]?.name ??
            lineName(sale.lines.find((line) => line.id === lineId) ?? sale.lines[0]!))
      }
      onClose={close}
      ariaLabel={copy('Who is doing this service?')}
      closeOnEscape={false}
      closeOnOverlay={!confirmDiscard}
      size="md"
      className="pos-reference-dialog w-full overflow-hidden"
      footer={
        <div className="flex items-center justify-end gap-2">
          <DButton variant="ghost" disabled={isSaving} onClick={close}>
            {copy('Cancel')}
          </DButton>
          <DButton
            loading={isSaving}
            disabled={isSaving || !employees.length || !targets.length || confirmReplace}
            onClick={save}
          >
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-control)] bg-[var(--color-danger)]/10 px-3 py-2 text-sm font-medium text-[var(--color-danger)]"
          >
            {error}
          </p>
        ) : null}

        {!employees.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('No active employees can perform this service.')}
          </p>
        ) : !targets.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('The service line is no longer available.')}
          </p>
        ) : (
          <>
            {multiple ? (
              <div
                role="radiogroup"
                aria-label={copy('How employees are assigned')}
                className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
              >
                {[false, true].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    role="radio"
                    aria-checked={perService === option}
                    disabled={isSaving}
                    onClick={() => chooseMode(option)}
                    className={`min-h-10 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30 ${
                      perService === option
                        ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {copy(option ? 'Different for each service' : 'Same for every service')}
                  </button>
                ))}
              </div>
            ) : null}

            {confirmReplace ? (
              <div
                role="alertdialog"
                aria-label={copy('Same for every service')}
                className="space-y-2 rounded-[var(--radius-control)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-3 text-sm"
              >
                <p className="text-[var(--color-text)]">
                  {copy('Each service has its own setting. Replace them all with the setting of')}{' '}
                  <strong>{targets[activeIndex]?.name}</strong>?
                </p>
                <div className="flex justify-end gap-2">
                  <DButton size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>
                    {copy('Cancel')}
                  </DButton>
                  <DButton
                    size="sm"
                    onClick={() => {
                      setShared(cloneAllocation(allocations[activeKey]!));
                      setPerService(false);
                      setConfirmReplace(false);
                    }}
                  >
                    {copy('Replace')}
                  </DButton>
                </div>
              </div>
            ) : null}

            {multiple && perService ? (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm font-semibold text-[var(--color-text)]">
                  <span>{copy('Service being set')}</span>
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">
                    {readyCount}/{targets.length} {copy('services set')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DButton
                    size="sm"
                    variant="outline"
                    aria-label={copy('Previous service')}
                    disabled={activeIndex === 0}
                    onClick={() => setActiveKey(targets[activeIndex - 1]!.key)}
                    className="size-10 shrink-0 px-0"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </DButton>
                  <DSelect
                    aria-label={copy('Service being set')}
                    value={activeKey}
                    options={serviceOptions}
                    clearable={false}
                    searchable={targets.length > 8}
                    onChange={(value) => {
                      if (typeof value === 'string') setActiveKey(value);
                    }}
                    containerClassName="min-w-0 flex-1"
                  />
                  <DButton
                    size="sm"
                    variant="outline"
                    aria-label={copy('Next service')}
                    disabled={activeIndex === targets.length - 1}
                    onClick={() => setActiveKey(targets[activeIndex + 1]!.key)}
                    className="size-10 shrink-0 px-0"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </DButton>
                </div>
                {activeStatus ? (
                  <p
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      activeStatus.ok
                        ? 'text-[var(--color-success)]'
                        : 'text-[var(--color-warning)]'
                    }`}
                  >
                    {activeStatus.ok ? (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    )}
                    {activeStatus.ok ? copy('Set') : activeStatus.text}
                  </p>
                ) : null}
              </div>
            ) : null}

            <EmployeeChecklist
              key={perService ? activeKey : 'shared'}
              legend={
                multiple
                  ? perService
                    ? copy('Employees for this service')
                    : `${copy('Applies to')} ${targets.length} ${copy('services')}`
                  : copy('Employees')
              }
              employees={employees}
              selected={active.employeeIds}
              disabled={isSaving || confirmReplace}
              onChange={(employeeIds) => setActive(withEmployees(active, employeeIds))}
            />

            <WorkSplit
              key={`split:${perService ? activeKey : 'shared'}`}
              allocation={active}
              nameOf={nameOf}
              disabled={isSaving || confirmReplace}
              onChange={setActive}
            />

            {multiple && perService ? (
              <DButton
                size="sm"
                variant="ghost"
                disabled={isSaving || resolveAllocation(active).issue !== null}
                onClick={() =>
                  setAllocations(
                    Object.fromEntries(
                      targets.map((target) => [target.key, cloneAllocation(active)]),
                    ),
                  )
                }
              >
                {copy('Use for all services')}
              </DButton>
            ) : null}
          </>
        )}
      </div>
      <DConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title={copy('Discard employee changes?')}
        message={copy('The employees and work split you changed will not be saved.')}
        confirmLabel={copy('Discard changes')}
        cancelLabel={copy('Keep editing')}
        variant="danger"
      />
    </DDialog>
  );
}
