import { createDecimal, formatMoney } from '@digvation/pos-money';
import { DButton, DCheckbox, DDecimalInput, DDialog, DInput, DSelect } from '@digvation-labs/ui';
import { CheckCircle2, CircleDot, Percent, Play, Square, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DiscountInput } from '../cashier-transaction.adapter';
import type {
  ContributionPreview,
  DiscountType,
  Employee,
  FulfillmentStatus,
  SaleLine,
} from '../cashier-transaction.types';
import { actionBlockMessage, type ActionAvailability } from '../sale-workspace-view-model';

interface SaleLineTaskDialogProps {
  line: SaleLine;
  employees: Employee[];
  contributionPreview: ContributionPreview | null;
  locale: string;
  monetaryAvailability: ActionAvailability;
  operationalAvailability: ActionAvailability;
  isBusy: boolean;
  onClose: () => void;
  onSetPriceOverride: (line: SaleLine, amount: string, reason: string) => void;
  onClearPriceOverride: (line: SaleLine) => void;
  onSetLineDiscount: (line: SaleLine, input: Omit<DiscountInput, 'expectedVersion'>) => void;
  onClearLineDiscount: (line: SaleLine) => void;
  onSetAssignments: (line: SaleLine, employeeIds: string[]) => void;
  onSetContributions: (
    line: SaleLine,
    contributors: Array<{ employeeId: string; shareRate?: string }>,
  ) => void;
  onTransitionFulfillment: (line: SaleLine, status: Exclude<FulfillmentStatus, 'WAITING'>) => void;
}

function rateToPercent(rate: string | null): string {
  return rate === null ? '' : createDecimal(rate).times(100).toFixed();
}

function percentToRate(percent: string): string | null {
  const value = percent.trim();
  if (value === '') return null;
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) return null;
  const decimal = createDecimal(value);
  if (decimal.lessThanOrEqualTo(0) || decimal.greaterThan(100)) return null;
  return decimal.dividedBy(100).toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
}

function discountValueForForm(type: DiscountType, value: string | null): string {
  if (!value) return '';
  return type === 'PERCENTAGE' ? createDecimal(value).times(100).toFixed() : value;
}

function discountValueForApi(type: DiscountType, value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(trimmed)) return null;
  const decimal = createDecimal(trimmed);
  if (decimal.isNegative()) return null;
  if (type === 'PERCENTAGE') {
    if (decimal.greaterThan(100)) return null;
    return decimal.dividedBy(100).toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
  }
  return trimmed;
}

function fulfillmentActions(status: FulfillmentStatus | null) {
  if (status === 'WAITING') return ['IN_PROGRESS', 'CANCELED'] as const;
  if (status === 'IN_PROGRESS') return ['COMPLETED', 'CANCELED'] as const;
  return [] as const;
}

export function SaleLineTaskDialog({
  line,
  employees,
  contributionPreview,
  locale,
  monetaryAvailability,
  operationalAvailability,
  isBusy,
  onClose,
  onSetPriceOverride,
  onClearPriceOverride,
  onSetLineDiscount,
  onClearLineDiscount,
  onSetAssignments,
  onSetContributions,
  onTransitionFulfillment,
}: SaleLineTaskDialogProps) {
  const [assignedIds, setAssignedIds] = useState<string[]>(() =>
    line.participations
      .filter((participation) => participation.assigned)
      .map((participation) => participation.employeeId),
  );
  const [contributionShares, setContributionShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      line.participations
        .filter((participation) => participation.shareRate !== null)
        .map((participation) => [participation.employeeId, rateToPercent(participation.shareRate)]),
    ),
  );
  const [overrideAmount, setOverrideAmount] = useState(
    line.overrideAmount ?? line.effectiveUnitPrice,
  );
  const [overrideReason, setOverrideReason] = useState(line.overrideReason ?? '');
  const initialDiscountType = line.discountType ?? 'PERCENTAGE';
  const [discountType, setDiscountType] = useState<DiscountType>(initialDiscountType);
  const [discountValue, setDiscountValue] = useState(
    discountValueForForm(initialDiscountType, line.discountValue),
  );
  const [discountReason, setDiscountReason] = useState(line.discountReason ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const monetaryDisabled = monetaryAvailability.state !== 'AVAILABLE' || isBusy;
  const operationalDisabled = operationalAvailability.state !== 'AVAILABLE' || isBusy;
  const monetaryMessage =
    monetaryAvailability.state === 'DISABLED'
      ? actionBlockMessage(monetaryAvailability.reason)
      : null;
  const operationalMessage =
    operationalAvailability.state === 'DISABLED'
      ? actionBlockMessage(operationalAvailability.reason)
      : null;

  const toggleAssignment = (employeeId: string) => {
    setAssignedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  };

  const toggleContributor = (employeeId: string) => {
    setContributionShares((current) => {
      if (employeeId in current) {
        const next = { ...current };
        delete next[employeeId];
        return next;
      }
      return { ...current, [employeeId]: '' };
    });
  };

  const saveContributions = () => {
    setFormError(null);
    const contributors: Array<{ employeeId: string; shareRate?: string }> = [];
    for (const [employeeId, percent] of Object.entries(contributionShares)) {
      const trimmed = percent.trim();
      if (trimmed === '') {
        contributors.push({ employeeId });
        continue;
      }
      const shareRate = percentToRate(trimmed);
      if (!shareRate) {
        setFormError('Contribution share must be greater than 0 and at most 100%.');
        return;
      }
      contributors.push({ employeeId, shareRate });
    }
    onSetContributions(line, contributors);
  };

  const saveDiscount = () => {
    setFormError(null);
    const value = discountValueForApi(discountType, discountValue);
    if (!value || discountReason.trim() === '') {
      setFormError('Discount value and reason are required. Percentage uses 0â€“100%.');
      return;
    }
    onSetLineDiscount(line, { type: discountType, value, reason: discountReason.trim() });
  };

  const saveOverride = () => {
    setFormError(null);
    if (!/^\d+(?:\.\d{1,4})?$/.test(overrideAmount.trim()) || overrideReason.trim() === '') {
      setFormError('Override amount and reason are required. Amount supports up to four decimals.');
      return;
    }
    onSetPriceOverride(line, overrideAmount.trim(), overrideReason.trim());
  };

  const actions = fulfillmentActions(line.fulfillment?.status ?? null);

  return (
    <DDialog
      open
      onClose={onClose}
      ariaLabel={`Manage ${line.itemNameSnapshot}`}
      className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:rounded-[var(--radius-card)]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            Line task
          </p>
          <h2 className="mt-2 text-xl font-bold">{line.itemNameSnapshot}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Assignment, contribution, fulfillment and monetary adjustments remain separate commands.
          </p>
        </div>
        <DButton variant="ghost" aria-label="Close line task" onClick={onClose} className="px-3">
          <X className="size-5" />
        </DButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-background)] p-4 sm:p-5">
        {formError ? (
          <div className="mb-5 rounded-[var(--radius-control)] bg-[var(--color-accent-coral)]/25 px-4 py-3 text-sm font-semibold">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {line.itemTypeSnapshot === 'SERVICE' && line.employeeAssignmentModeSnapshot !== 'NONE' ? (
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <UserRound className="size-4" />
                <h3 className="font-bold">Employee assignment</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                Mode: {line.employeeAssignmentModeSnapshot}. Assignment is operational and does not
                define contribution share.
              </p>
              <div className="mt-4 space-y-2">
                {employees.map((employee) => (
                  <label
                    key={employee.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] px-3 py-2.5 text-sm"
                  >
                    <DCheckbox
                      checked={assignedIds.includes(employee.id)}
                      disabled={operationalDisabled}
                      onChange={() => toggleAssignment(employee.id)}
                    />
                    <span className="font-semibold">{employee.displayName}</span>
                    <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                      {employee.code}
                    </span>
                  </label>
                ))}
                {employees.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    No ACTIVE employees available.
                  </p>
                ) : null}
              </div>
              {operationalMessage ? (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">{operationalMessage}</p>
              ) : null}
              <DButton
                variant="secondary"
                className="mt-4 w-full"
                disabled={operationalDisabled}
                onClick={() => onSetAssignments(line, assignedIds)}
              >
                Save assignment
              </DButton>
            </article>
          ) : null}

          {line.allowEmployeeContributionSnapshot ? (
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Percent className="size-4" />
                <h3 className="font-bold">Employee contribution</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                Leave all shares blank for equal split. Partial shares are allowed; the backend
                distributes the remaining share deterministically.
              </p>
              <div className="mt-4 space-y-2">
                {employees.map((employee) => {
                  const selected = employee.id in contributionShares;
                  return (
                    <div
                      key={employee.id}
                      className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3"
                    >
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <DCheckbox
                          checked={selected}
                          disabled={operationalDisabled}
                          onChange={() => toggleContributor(employee.id)}
                        />
                        <span className="font-semibold">{employee.displayName}</span>
                      </label>
                      {selected ? (
                        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                          Share %
                          <DInput
                            aria-label={`${employee.displayName} contribution share`}
                            value={contributionShares[employee.id] ?? ''}
                            disabled={operationalDisabled}
                            onChange={(value) =>
                              setContributionShares((current) => ({
                                ...current,
                                [employee.id]: value,
                              }))
                            }
                            placeholder="auto"
                            inputMode="decimal"
                            className="ml-auto w-28 text-right"
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <DButton
                variant="secondary"
                className="mt-4 w-full"
                disabled={operationalDisabled}
                onClick={saveContributions}
              >
                Save contribution
              </DButton>

              {contributionPreview ? (
                <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                    Backend preview
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    Base{' '}
                    {formatMoney(contributionPreview.contributionBaseAmount, line.currency, locale)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    {contributionPreview.preview.map((entry) => (
                      <div key={entry.employeeId} className="flex justify-between gap-3">
                        <span className="text-[var(--color-text-muted)]">
                          {employeeById.get(entry.employeeId)?.displayName ??
                            entry.employeeId.slice(0, 8)}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatMoney(entry.contributionAmount, line.currency, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ) : null}

          {line.fulfillmentBehaviorSnapshot === 'TRACKED' && line.fulfillment ? (
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <CircleDot className="size-4" />
                <h3 className="font-bold">Tracked fulfillment</h3>
              </div>
              <p className="mt-2 text-sm">
                Current status: <strong>{line.fulfillment.status}</strong>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {actions.map((status) => (
                  <DButton
                    key={status}
                    variant="secondary"
                    disabled={operationalDisabled}
                    onClick={() => onTransitionFulfillment(line, status)}
                  >
                    {status === 'IN_PROGRESS' ? <Play className="mr-2 size-4" /> : null}
                    {status === 'COMPLETED' ? <CheckCircle2 className="mr-2 size-4" /> : null}
                    {status === 'CANCELED' ? <Square className="mr-2 size-4" /> : null}
                    {status.replace('_', ' ')}
                  </DButton>
                ))}
                {actions.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    No further CP2 transition is available.
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <h3 className="font-bold">Price override</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Resolved price stays captured. Override stores a separate final unit price and reason.
            </p>
            <label className="mt-4 block text-xs font-semibold text-[var(--color-text-muted)]">
              Unit amount
              <DInput
                aria-label="Price override amount"
                value={overrideAmount}
                disabled={monetaryDisabled}
                onChange={setOverrideAmount}
                inputMode="decimal"
                className="mt-1.5"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-[var(--color-text-muted)]">
              Reason
              <DInput
                aria-label="Price override reason"
                value={overrideReason}
                disabled={monetaryDisabled}
                onChange={setOverrideReason}
                className="mt-1.5"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <DButton variant="secondary" disabled={monetaryDisabled} onClick={saveOverride}>
                Apply override
              </DButton>
              {line.overrideAmount ? (
                <DButton
                  variant="ghost"
                  disabled={monetaryDisabled}
                  onClick={() => onClearPriceOverride(line)}
                >
                  Remove
                </DButton>
              ) : null}
            </div>
            {monetaryMessage ? (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">{monetaryMessage}</p>
            ) : null}
          </article>

          <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <h3 className="font-bold">Line discount</h3>
            <div className="mt-4 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
              <DSelect
                aria-label="Line discount type"
                value={discountType}
                disabled={monetaryDisabled}
                clearable={false}
                onChange={(value) => {
                  if (typeof value !== 'string') return;
                  const next = value as DiscountType;
                  setDiscountType(next);
                  setDiscountValue('');
                }}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
              </DSelect>
              <DDecimalInput
                aria-label="Line discount value"
                value={discountValue}
                disabled={monetaryDisabled}
                onValueChange={setDiscountValue}
                placeholder={discountType === 'PERCENTAGE' ? '10 (%)' : '50000'}
              />
            </div>
            <DInput
              aria-label="Line discount reason"
              value={discountReason}
              disabled={monetaryDisabled}
              onChange={setDiscountReason}
              placeholder="Reason"
              className="mt-2"
            />
            <div className="mt-4 flex gap-2">
              <DButton variant="secondary" disabled={monetaryDisabled} onClick={saveDiscount}>
                Apply discount
              </DButton>
              {line.discountType ? (
                <DButton
                  variant="ghost"
                  disabled={monetaryDisabled}
                  onClick={() => onClearLineDiscount(line)}
                >
                  Remove
                </DButton>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </DDialog>
  );
}
