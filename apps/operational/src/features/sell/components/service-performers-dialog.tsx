import { createDecimal } from '@digvation/pos-money';
import {
  DAccordion,
  DAccordionItem,
  DAlert,
  DButton,
  DCheckbox,
  DConfirmDialog,
  DDialog,
  DInput,
  DSeparator,
} from '@digvation/ui';
import { AlertTriangle, CheckCircle2, Search, Users } from 'lucide-react';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { Employee, Sale, SaleLine } from '../cashier-transaction.types';
import { employeeDisplayName } from '../sale-presentation';
import {
  allocationFromRates,
  allocationRates,
  cloneAllocation,
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

/** One separately performed unit of a service line, with a stable identity. */
interface ServiceTarget {
  key: string;
  lineId: string;
  lineName: string;
  /** 1-based unit within its line. */
  unit: number;
}

function lineName(line: SaleLine) {
  return line.variantNameSnapshot
    ? `${line.itemNameSnapshot} (${line.variantNameSnapshot})`
    : line.itemNameSnapshot;
}

/** Every performed unit of the sale: one per unit of each editable service line. */
function serviceTargets(sale: Sale): ServiceTarget[] {
  return sale.lines.filter(editableService).flatMap((line) =>
    [...Array(serviceWorkUnitCount(line)).keys()].map((index) => ({
      key: `${line.id}:${index}`,
      lineId: line.id,
      lineName: lineName(line),
      unit: index + 1,
    })),
  );
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
      containerClassName="w-16 shrink-0"
      className={`text-right tabular-nums ${
        share.manual ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
      } ${unreadable ? 'border-[var(--color-danger)]' : ''}`}
    />
  );
}

/**
 * Who performs ONE unit, and how they share it, as a single control. Ticking an
 * employee selects them; once two or more are ticked each ticked row gains its
 * own percentage, so selection and contribution are read and edited on the same
 * row rather than in two stacked blocks. A one-line total with "Split evenly"
 * closes the list, and only when the work is actually shared. Shares attribute
 * one unit's work only and never change amounts.
 */
function EmployeeChoices({
  allocation,
  employees,
  nameOf,
  disabled,
  onChange,
}: {
  allocation: PerformerAllocation;
  employees: readonly Employee[];
  nameOf: (employeeId: string) => string;
  disabled: boolean;
  onChange: (next: PerformerAllocation) => void;
}) {
  const { copy, locale } = useOperationalLocalization();
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
  const { shares, total, issue } = resolveAllocation(allocation);
  const shareOf = new Map(shares.map((share) => [share.employeeId, share]));
  const sharing = shares.length >= 2;
  const typed = shares.some((share) => share.manual);
  const selected = allocation.employeeIds;

  return (
    <div className="min-w-0">
      <fieldset className="min-w-0">
        <legend className="sr-only">{copy('Employees for this service')}</legend>
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
        {/* The list scrolls; its own padding lets row highlights reach past the text edge. */}
        <ul className="-mx-2 my-0 max-h-[min(15rem,34dvh)] list-none space-y-0.5 overflow-y-auto px-2 py-0">
          {visible.map((employee) => {
            const checked = selected.includes(employee.id);
            const share = shareOf.get(employee.id);
            return (
              <li key={employee.id} className="flex min-h-11 items-center gap-1 sm:min-h-10">
                <label className="-ml-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 text-sm transition-colors hover:bg-[var(--color-surface-muted)] sm:min-h-10">
                  <DCheckbox
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onChange(
                        withEmployees(
                          allocation,
                          checked
                            ? selected.filter((id) => id !== employee.id)
                            : [...selected, employee.id],
                        ),
                      )
                    }
                  />
                  <span
                    className={`min-w-0 flex-1 break-words ${
                      checked
                        ? 'font-semibold text-[var(--color-text)]'
                        : sharing
                          ? 'text-[var(--color-text-muted)]'
                          : ''
                    }`}
                  >
                    {employee.displayName}
                  </span>
                  {!sharing || !checked ? (
                    <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                      {employee.code}
                    </span>
                  ) : null}
                </label>
                {sharing && share ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <ShareInput
                      share={share}
                      label={`${copy('Share (%)')} ${nameOf(share.employeeId)}`}
                      disabled={disabled}
                      onCommit={(basisPoints) =>
                        onChange(withShare(allocation, share.employeeId, basisPoints))
                      }
                    />
                    <span className="text-xs text-[var(--color-text-muted)]">%</span>
                  </span>
                ) : null}
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="py-3 text-sm text-[var(--color-text-muted)]">
              {copy('No employee matches this search.')}
            </li>
          ) : null}
        </ul>
      </fieldset>
      {sharing ? (
        <section
          aria-label={copy('Work split')}
          className="flex min-h-9 items-center justify-between gap-3 pt-1 text-xs"
        >
          <span
            className={`flex min-w-0 items-center gap-1.5 font-medium ${
              issue ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {issue ? (
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="size-3.5 shrink-0 text-[var(--color-success)]"
                aria-hidden="true"
              />
            )}
            {issue && issue !== 'EMPTY'
              ? copy(issueCopy[issue])
              : `${copy('Total')} ${formatPercent(total, locale)}%`}
          </span>
          <DButton
            size="sm"
            variant={typed ? 'soft' : 'ghost'}
            disabled={disabled || !typed}
            onClick={() => onChange(evenAllocation(allocation))}
            className="h-8 shrink-0 px-2.5 text-xs"
          >
            {copy('Split evenly')}
          </DButton>
        </section>
      ) : null}
    </div>
  );
}

/** Who performs one unit, in one line: "Andini", or "Andini 60% · Rindu 40%" when it is split. */
function performerText(
  allocation: PerformerAllocation,
  nameOf: (employeeId: string) => string,
  locale: string,
) {
  const { shares } = resolveAllocation(allocation);
  if (shares.length < 2) return shares.map((share) => nameOf(share.employeeId)).join('');
  return shares
    .map((share) => `${nameOf(share.employeeId)} ${formatPercent(share.basisPoints, locale)}%`)
    .join(' · ');
}

/** The editor of one unit: who performs it and how they share it, plus the explicit bulk action. */
function UnitEditor({
  allocation,
  employees,
  nameOf,
  disabled,
  offerApplyToAll,
  onChange,
  onApplyToAll,
}: {
  allocation: PerformerAllocation;
  employees: readonly Employee[];
  nameOf: (employeeId: string) => string;
  disabled: boolean;
  offerApplyToAll: boolean;
  onChange: (next: PerformerAllocation) => void;
  onApplyToAll: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const { issue } = resolveAllocation(allocation);
  return (
    // DAccordion sets its panel text muted for descriptive content; these are controls.
    <div className="leading-normal text-[var(--color-text)]">
      <EmployeeChoices
        allocation={allocation}
        employees={employees}
        nameOf={nameOf}
        disabled={disabled}
        onChange={onChange}
      />
      {offerApplyToAll ? (
        <>
          <DSeparator className="mb-2 mt-3" />
          <DButton
            size="sm"
            variant="ghost"
            leftIcon={<Users className="size-3.5" aria-hidden="true" />}
            disabled={disabled || issue !== null}
            onClick={onApplyToAll}
            className="-ml-2 text-[var(--color-brand)]"
          >
            {copy('Use for all work')}
          </DButton>
        </>
      ) : null}
    </div>
  );
}

/** Who performs it, plainly; only a missing or invalid assignment earns an icon and colour. */
function StatusText({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 text-xs ${
        ok ? 'font-normal text-[var(--color-text-muted)]' : 'font-medium text-[var(--color-warning)]'
      }`}
    >
      {ok ? null : <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

/**
 * Chooses who performs ONE service line: the line the user clicked, and nothing
 * else. A line with quantity 2 keeps its two work units inside this dialog, each
 * with its own performers. One assignment map keyed by `lineId:unitIndex` is the
 * only state, so changing one unit can never reach another. "Use for all work"
 * is an explicit action that copies one unit to the other units of this line;
 * it never reaches other lines.
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
  const { copy, locale } = useOperationalLocalization();
  const [targets] = useState(() =>
    serviceTargets(sale).filter((target) => target.lineId === lineId),
  );
  const [initial] = useState(() =>
    Object.fromEntries(
      Object.entries(initialAllocations(sale)).filter(([key]) => key.startsWith(`${lineId}:`)),
    ),
  );
  const [allocations, setAllocations] = useState<Record<string, PerformerAllocation>>(() =>
    Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, cloneAllocation(value)])),
  );
  const [openUnit, setOpenUnit] = useState<string | null>(targets[0]?.key ?? null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const line = sale.lines.find((candidate) => candidate.id === lineId);
  const name = targets[0]?.lineName ?? (line ? lineName(line) : '');
  const dirty = targets.some(
    (target) => !sameAllocation(allocations[target.key]!, initial[target.key]!),
  );
  const nameOf = (employeeId: string) =>
    employeeDisplayName(line ?? sale.lines[0]!, employeeId, employees, copy('Employee unavailable'));
  const issueOf = (key: string) => resolveAllocation(allocations[key]!).issue;
  const setUnit = (key: string, next: PerformerAllocation) => {
    setError(null);
    setAllocations((current) => ({ ...current, [key]: next }));
  };
  const applyToAll = (key: string) => {
    setError(null);
    setAllocations(
      Object.fromEntries(
        targets.map((target) => [target.key, cloneAllocation(allocations[key]!)]),
      ),
    );
  };

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
      if (event.key !== 'Escape' || document.querySelector('[role="option"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const save = () => {
    setError(null);
    if (!dirty) {
      onClose();
      return;
    }
    const invalid = targets.find((target) => issueOf(target.key) !== null);
    if (invalid) {
      const issue = issueOf(invalid.key)!;
      setOpenUnit(invalid.key);
      setError(
        `${targets.length > 1 ? `${invalid.lineName} · ${copy('Work')} ${invalid.unit}` : invalid.lineName}: ${copy(issueCopy[issue])}`,
      );
      return;
    }
    onSave([
      {
        lineId,
        units: targets.map((target) => allocationRates(allocations[target.key]!)),
      },
    ]);
  };

  const unitProblem = (key: string) =>
    issueOf(key) === 'EMPTY' ? copy('No employee yet') : copy('Check the percentages');

  const editorOf = (target: ServiceTarget, offerApplyToAll: boolean) => (
    <UnitEditor
      allocation={allocations[target.key]!}
      employees={employees}
      nameOf={nameOf}
      disabled={isSaving}
      offerApplyToAll={offerApplyToAll}
      onChange={(next) => setUnit(target.key, next)}
      onApplyToAll={() => applyToAll(target.key)}
    />
  );

  return (
    <DDialog
      open
      title={copy('Who is doing this service?')}
      description={`${name}${targets.length > 1 ? ` ×${targets.length}` : ''}`}
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
            disabled={isSaving || !employees.length || !targets.length}
            onClick={save}
          >
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? <DAlert variant="danger">{error}</DAlert> : null}

        {!employees.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('No active employees can perform this service.')}
          </p>
        ) : !targets.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('The service line is no longer available.')}
          </p>
        ) : targets.length === 1 ? (
          editorOf(targets[0]!, false)
        ) : (
          // Each work unit is a surface; the open one is lifted and the rest recede.
          <DAccordion
            type="single"
            variant="separated"
            value={openUnit ? [openUnit] : []}
            onValueChange={(next) => setOpenUnit(next[0] ?? null)}
          >
            {targets.map((target) => {
              const ok = issueOf(target.key) === null;
              const active = openUnit === target.key;
              return (
                <DAccordionItem
                  key={target.key}
                  value={target.key}
                  disabled={isSaving}
                  className={
                    active
                      ? 'border-[var(--color-brand)]/40 shadow-[var(--shadow-md)]'
                      : 'border-transparent bg-[var(--color-surface-muted)]/60'
                  }
                  title={
                    <span className="block min-w-0">
                      <span className="block break-words font-semibold">
                        {copy('Work')} {target.unit}
                      </span>
                      <span className="mt-0.5 block">
                        <StatusText ok={ok}>
                          {ok
                            ? performerText(allocations[target.key]!, nameOf, locale)
                            : unitProblem(target.key)}
                        </StatusText>
                      </span>
                    </span>
                  }
                >
                  {/* DAccordion keeps closed panels mounted and focusable; only the open one renders. */}
                  {active ? editorOf(target, true) : null}
                </DAccordionItem>
              );
            })}
          </DAccordion>
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
