import { createDecimal, formatMoney } from '@digvation/pos-money';
import { DButton, DCheckbox, DDecimalInput, DDialog, DInput, DSelect } from '@digvation-labs/ui';
import { CheckCircle2, Play, Square, UserRound, X } from 'lucide-react';
import { useState } from 'react';

import {
  operationalCopy,
  operationalLabel,
  resolveOperationalLocale,
} from '../../../app/localization/operational-localization';
import type { DiscountInput } from '../cashier-transaction.adapter';
import type {
  ContributionPreview,
  DiscountType,
  Employee,
  FulfillmentStatus,
  SaleLine,
} from '../cashier-transaction.types';
import { employeeDisplayName } from '../sale-presentation';
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
  const operationalLocale = resolveOperationalLocale(locale);
  const copy = (value: string) => operationalCopy(value, operationalLocale);
  const label = (value: string) => operationalLabel(value, operationalLocale);
  const [assignedIds, setAssignedIds] = useState<string[]>(() =>
    line.participations
      .filter((participation) => participation.assigned)
      .map((participation) => participation.employeeId),
  );
  const [performerShares, setPerformerShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      line.participations
        .filter((participation) => participation.assigned)
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

  const monetaryDisabled = monetaryAvailability.state !== 'AVAILABLE' || isBusy;
  const operationalDisabled = operationalAvailability.state !== 'AVAILABLE' || isBusy;
  const monetaryMessage =
    monetaryAvailability.state === 'DISABLED'
      ? actionBlockMessage(monetaryAvailability.reason, locale)
      : null;
  const operationalMessage =
    operationalAvailability.state === 'DISABLED'
      ? actionBlockMessage(operationalAvailability.reason, locale)
      : null;

  const togglePerformer = (employeeId: string) => {
    const selected = assignedIds.includes(employeeId);
    setAssignedIds((current) =>
      selected ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
    setPerformerShares((current) => {
      if (!selected) return { ...current, [employeeId]: current[employeeId] ?? '' };
      const next = { ...current };
      delete next[employeeId];
      return next;
    });
  };

  const savePerformers = () => {
    setFormError(null);
    if (!assignedIds.length) {
      setFormError(copy('Select at least one service worker.'));
      return;
    }

    const performers: Array<{ employeeId: string; shareRate?: string }> = [];
    let explicitTotal = createDecimal('0');
    let explicitCount = 0;

    for (const employeeId of assignedIds) {
      const percent = performerShares[employeeId]?.trim() ?? '';
      if (!percent) {
        performers.push({ employeeId });
        continue;
      }
      const shareRate = percentToRate(percent);
      if (!shareRate) {
        setFormError(copy('Worker share must be greater than 0% and at most 100%.'));
        return;
      }
      explicitCount += 1;
      explicitTotal = explicitTotal.plus(createDecimal(percent));
      performers.push({ employeeId, shareRate });
    }

    if (explicitCount === assignedIds.length && !explicitTotal.equals(createDecimal('100'))) {
      setFormError(copy('When all shares are entered, the total must be exactly 100%.'));
      return;
    }
    if (
      explicitCount < assignedIds.length &&
      explicitTotal.greaterThanOrEqualTo(createDecimal('100'))
    ) {
      setFormError(copy('Leave room for workers whose share is split automatically.'));
      return;
    }

    onSetAssignments(line, assignedIds);
    onSetContributions(line, performers);
  };

  const saveDiscount = () => {
    setFormError(null);
    const value = discountValueForApi(discountType, discountValue);
    if (!value || discountReason.trim() === '') {
      setFormError(
        copy('Discount value and reason are required. Percentage must be between 0 and 100%.'),
      );
      return;
    }
    onSetLineDiscount(line, { type: discountType, value, reason: discountReason.trim() });
  };

  const saveOverride = () => {
    setFormError(null);
    if (!/^\d+(?:\.\d{1,4})?$/.test(overrideAmount.trim()) || overrideReason.trim() === '') {
      setFormError(copy('Price and reason are required.'));
      return;
    }
    onSetPriceOverride(line, overrideAmount.trim(), overrideReason.trim());
  };

  const actions = fulfillmentActions(line.fulfillment?.status ?? null);
  const isService = line.itemTypeSnapshot === 'SERVICE';

  return (
    <DDialog
      open
      onClose={onClose}
      ariaLabel={`${copy('Transaction item')}: ${line.itemNameSnapshot}`}
      className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:rounded-[var(--radius-card)]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
            {copy('Transaction item')}
          </p>
          <h2 className="mt-2 text-xl font-bold">{line.itemNameSnapshot}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy(
              isService
                ? 'Configure service workers, work status, price, or item discount.'
                : 'Configure price or item discount.',
            )}
          </p>
        </div>
        <DButton variant="ghost" aria-label={copy('Close')} onClick={onClose} className="px-3">
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
          {isService ? (
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-2">
                <UserRound className="size-4" />
                <h3 className="font-bold">{copy('Service workers')}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                {copy(
                  'Select employees who perform this service. Leave shares blank to split evenly.',
                )}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {employees.map((employee) => {
                  const selected = assignedIds.includes(employee.id);
                  return (
                    <div
                      key={employee.id}
                      className={`rounded-[var(--radius-control)] border p-3 ${
                        selected
                          ? 'border-[var(--color-brand)]/35 bg-[var(--color-brand)]/5'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-muted)]/55'
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <DCheckbox
                          checked={selected}
                          disabled={operationalDisabled}
                          onChange={() => togglePerformer(employee.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {employee.displayName}
                          </span>
                          <span className="block text-xs text-[var(--color-text-muted)]">
                            {employee.code}
                          </span>
                        </span>
                      </label>
                      {selected && assignedIds.length > 1 ? (
                        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                          {copy('Share (%)')}
                          <DInput
                            aria-label={`${copy('Share (%)')} ${employee.displayName}`}
                            value={performerShares[employee.id] ?? ''}
                            disabled={operationalDisabled}
                            onChange={(value) =>
                              setPerformerShares((current) => ({
                                ...current,
                                [employee.id]: value,
                              }))
                            }
                            placeholder={copy('Split evenly')}
                            inputMode="decimal"
                            className="ml-auto w-28 text-right"
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {employees.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                  {copy('No active employees can perform this service.')}
                </p>
              ) : null}
              {operationalMessage ? (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">{operationalMessage}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <DButton
                  variant="secondary"
                  disabled={operationalDisabled || !employees.length}
                  onClick={savePerformers}
                >
                  {copy('Save workers')}
                </DButton>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {assignedIds.length
                    ? `${assignedIds.length} ${copy('workers selected')}`
                    : copy('No workers selected')}
                </span>
              </div>

              {contributionPreview?.preview.length ? (
                <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {copy('Service value allocation')}
                  </p>
                  <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                    {contributionPreview.preview.map((entry) => (
                      <div key={entry.employeeId} className="flex justify-between gap-3">
                        <span className="truncate text-[var(--color-text-muted)]">
                          {employeeDisplayName(
                            line,
                            entry.employeeId,
                            employees,
                            copy('Employee unavailable'),
                          )}
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

          {isService && line.fulfillment ? (
            <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <h3 className="font-bold">{copy('Work status')}</h3>
              <p className="mt-2 text-sm">
                {copy('Current status')}: <strong>{label(line.fulfillment.status)}</strong>
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
                    {copy(
                      status === 'IN_PROGRESS'
                        ? 'Start work'
                        : status === 'COMPLETED'
                          ? 'Mark complete'
                          : 'Cancel work',
                    )}
                  </DButton>
                ))}
                {actions.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {copy('No further status changes are available.')}
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <h3 className="font-bold">{copy('Price adjustment')}</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('Set a transaction-specific price without changing the catalog price.')}
            </p>
            <label className="mt-4 block text-xs font-semibold text-[var(--color-text-muted)]">
              {copy('Unit price')}
              <DInput
                aria-label={copy('Unit price')}
                value={overrideAmount}
                disabled={monetaryDisabled}
                onChange={setOverrideAmount}
                inputMode="decimal"
                className="mt-1.5"
              />
            </label>
            <label className="mt-3 block text-xs font-semibold text-[var(--color-text-muted)]">
              {copy('Reason')}
              <DInput
                aria-label={copy('Reason')}
                value={overrideReason}
                disabled={monetaryDisabled}
                onChange={setOverrideReason}
                className="mt-1.5"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <DButton variant="secondary" disabled={monetaryDisabled} onClick={saveOverride}>
                {copy('Apply')}
              </DButton>
              {line.overrideAmount ? (
                <DButton
                  variant="ghost"
                  disabled={monetaryDisabled}
                  onClick={() => onClearPriceOverride(line)}
                >
                  {copy('Remove')}
                </DButton>
              ) : null}
            </div>
            {monetaryMessage ? (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">{monetaryMessage}</p>
            ) : null}
          </article>

          <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <h3 className="font-bold">{copy('Item discount')}</h3>
            <div className="mt-4 grid grid-cols-[140px_minmax(0,1fr)] gap-2">
              <DSelect
                aria-label={copy('Item discount')}
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
                <option value="PERCENTAGE">{copy('Percentage')}</option>
                <option value="FIXED_AMOUNT">{copy('Fixed amount')}</option>
              </DSelect>
              <DDecimalInput
                aria-label={copy('Item discount')}
                value={discountValue}
                disabled={monetaryDisabled}
                onValueChange={setDiscountValue}
                placeholder={discountType === 'PERCENTAGE' ? '10 (%)' : '50000'}
              />
            </div>
            <DInput
              aria-label={copy('Discount reason')}
              value={discountReason}
              disabled={monetaryDisabled}
              onChange={setDiscountReason}
              placeholder={copy('Discount reason')}
              className="mt-2"
            />
            <div className="mt-4 flex gap-2">
              <DButton variant="secondary" disabled={monetaryDisabled} onClick={saveDiscount}>
                {copy('Apply discount')}
              </DButton>
              {line.discountType ? (
                <DButton
                  variant="ghost"
                  disabled={monetaryDisabled}
                  onClick={() => onClearLineDiscount(line)}
                >
                  {copy('Remove')}
                </DButton>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </DDialog>
  );
}
