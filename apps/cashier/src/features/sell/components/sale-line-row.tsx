import { compareDecimalStrings, createDecimal, formatMoney } from '@digvation/pos-money';
import { DBadge, DButton } from '@digvation/ui';
import { Minus, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';

import type { SaleLine } from '../cashier-transaction.types';
import type { ActionAvailability } from '../sale-workspace-view-model';

interface SaleLineRowProps {
  line: SaleLine;
  locale: string;
  availability: ActionAvailability;
  onQuantityChange: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  onManage: (line: SaleLine) => void;
}

export function SaleLineRow({
  line,
  locale,
  availability,
  onQuantityChange,
  onRemove,
  onManage,
}: SaleLineRowProps) {
  const isDisabled = availability.state !== 'AVAILABLE';
  const canDecrease = !isDisabled && compareDecimalStrings(line.quantity, '1') > 0;
  const assignedCount = line.participations.filter(
    (participation) => participation.assigned,
  ).length;
  const contributorCount = line.participations.filter(
    (participation) => participation.shareRate !== null,
  ).length;

  const increase = () => onQuantityChange(line, createDecimal(line.quantity).plus('1').toFixed());
  const decrease = () => {
    if (canDecrease) onQuantityChange(line, createDecimal(line.quantity).minus('1').toFixed());
  };

  return (
    <article className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{line.itemNameSnapshot}</p>
          <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
            {line.variantNameSnapshot ? `${line.variantNameSnapshot} Ã‚Â· ` : ''}
            {line.itemCodeSnapshot}
          </p>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums">
          {formatMoney(line.totalAmount, line.currency, locale)}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
        {line.fulfillment ? (
          <DBadge className="bg-[var(--color-accent-sky)]/45 px-2 py-1">
            {line.fulfillment.status}
          </DBadge>
        ) : null}
        {assignedCount > 0 ? (
          <DBadge className="bg-[var(--color-accent-mint)]/55 px-2 py-1">
            {assignedCount} assigned
          </DBadge>
        ) : null}
        {contributorCount > 0 ? (
          <DBadge className="bg-[var(--color-accent-lavender)]/55 px-2 py-1">
            {contributorCount} contributors
          </DBadge>
        ) : null}
        {line.overrideAmount ? (
          <DBadge className="bg-[var(--color-accent-yellow)]/50 px-2 py-1">Override</DBadge>
        ) : null}
        {line.discountType ? (
          <DBadge className="bg-[var(--color-accent-coral)]/30 px-2 py-1">Discount</DBadge>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
          <DButton
            variant="ghost"
            type="button"
            aria-label={`Decrease ${line.itemNameSnapshot} quantity`}
            disabled={!canDecrease}
            onClick={decrease}
            className="grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] disabled:opacity-35"
          >
            <Minus className="size-4" />
          </DButton>
          <span className="min-w-10 px-2 text-center text-sm font-bold tabular-nums">
            {line.quantity}
          </span>
          <DButton
            variant="ghost"
            type="button"
            aria-label={`Increase ${line.itemNameSnapshot} quantity`}
            disabled={isDisabled}
            onClick={increase}
            className="grid size-8 place-items-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] disabled:opacity-35"
          >
            <Plus className="size-4" />
          </DButton>
        </div>

        <div className="flex gap-1">
          <DButton
            variant="ghost"
            aria-label={`Manage ${line.itemNameSnapshot}`}
            onClick={() => onManage(line)}
            size="sm"
            className="px-2"
          >
            <SlidersHorizontal className="size-4" />
          </DButton>
          <DButton
            variant="ghost"
            aria-label={`Remove ${line.itemNameSnapshot}`}
            disabled={isDisabled}
            onClick={() => onRemove(line)}
            size="sm"
            className="px-2 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
          >
            <Trash2 className="size-4" />
          </DButton>
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Unit {formatMoney(line.effectiveUnitPrice, line.currency, locale)}
      </p>
    </article>
  );
}
