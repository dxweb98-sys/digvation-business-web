import { createDecimal } from '@digvation/pos-money';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { Employee, Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import { money, quantity } from '../transaction/model/sale-display';
import { additionPerformedBy } from '../transaction/model/sale-line-additions';
import { correctionSourceOf, saleLineAdjustmentMode } from './sale-adjustment-access';

const stepperClass =
  'flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40';

/**
 * One Sale line in the adjustment: what it is and what changed since the dialog opened, and only
 * the changes its work state allows (direct edit, audited correction, or none).
 */
export function OrderAdjustmentLine({
  sale,
  line,
  addedInThisAdjustment,
  baselineQuantity,
  sellable,
  employees,
  locale,
  isMutating,
  onQuantity,
  onRemove,
  onEdit,
  onStartCorrection,
}: {
  sale: Sale;
  line: SaleLine;
  /** The line did not exist when the dialog opened. */
  addedInThisAdjustment: boolean;
  /** Quantity when the dialog opened; undefined for a line added since. */
  baselineQuantity: string | undefined;
  /** The line's Catalog item is still sold, so it can be edited. */
  sellable: boolean;
  employees: readonly Employee[];
  locale: string;
  isMutating: boolean;
  onQuantity: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  onEdit: (line: SaleLine) => void;
  onStartCorrection: (line: SaleLine) => void;
}) {
  const { copy } = useOperationalLocalization();
  // Runtime stays the authority; this only decides which controls are offered.
  const mode = saleLineAdjustmentMode(sale, line, {
    addedInThisAdjustment,
  });
  const correctedFrom = correctionSourceOf(sale, line);
  const editable = mode === 'EDIT';
  const canDecrease = editable && createDecimal(line.quantity).greaterThan(createDecimal('1'));
  const before = baselineQuantity;
  const lineChange =
    before === undefined
      ? copy('New')
      : createDecimal(before).equals(createDecimal(line.quantity))
        ? null
        : `${copy('Was')} ${quantity(before)}`;
  return (
    <li
      data-adjustment-mode={mode}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2"
    >
      <div className="min-w-0 flex-1 basis-40">
        <p
          className="truncate text-sm"
          title={`${line.itemNameSnapshot}${line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}`}
        >
          <span className="font-semibold">{line.itemNameSnapshot}</span>
          {line.variantNameSnapshot ? (
            <span className="text-[var(--color-text-muted)]"> · {line.variantNameSnapshot}</span>
          ) : null}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-[var(--color-text-muted)]">
          {money(line.effectiveUnitPrice, locale)}
          {lineChange ? (
            <span className="rounded-full bg-[var(--color-brand)]/10 px-1.5 text-[10px] font-semibold text-[var(--color-brand)]">
              {lineChange}
            </span>
          ) : null}
        </p>
        {line.soldByEmployeeNameSnapshot ? (
          // The Product salesperson; Service performers are a separate concept.
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {copy('Sold by')} {line.soldByEmployeeNameSnapshot}
          </p>
        ) : null}
        {(line.compositionComponents ?? [])
          .filter(
            (component) =>
              component.componentSource === 'SALE_SELECTED' && component.performers?.length,
          )
          .map((component) => (
            // Part of this Service's work, never a Product sale of its own.
            <p key={component.id} className="text-[11px] text-[var(--color-text-muted)]">
              +{' '}
              {[component.itemNameSnapshot, component.variantNameSnapshot]
                .filter(Boolean)
                .join(' / ')}{' '}
              ·{' '}
              {additionPerformedBy(
                {
                  performerIds: component.performers!.map((performer) => performer.employeeId),
                },
                employees,
                copy,
              )}
            </p>
          ))}
        {correctedFrom ? (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Koreksi dari {correctedFrom.itemNameSnapshot}
            {correctedFrom.fulfillment ? ' · pekerjaan awal tetap tercatat' : ''}
          </p>
        ) : null}
        {mode === 'LOCKED' ? (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Item yang sudah selesai dikerjakan tidak dapat dikoreksi.
          </p>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {editable ? (
          <>
            <button
              type="button"
              aria-label={`${copy('Decrease quantity')} ${line.itemNameSnapshot}`}
              disabled={!canDecrease || isMutating}
              onClick={() =>
                onQuantity(line, createDecimal(line.quantity).minus(createDecimal('1')).toFixed(4))
              }
              className={stepperClass}
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-7 text-center text-xs font-semibold tabular-nums">
              {quantity(line.quantity)}
            </span>
            <button
              type="button"
              aria-label={`${copy('Increase quantity')} ${line.itemNameSnapshot}`}
              disabled={isMutating}
              onClick={() =>
                onQuantity(line, createDecimal(line.quantity).plus(createDecimal('1')).toFixed(4))
              }
              className={stepperClass}
            >
              <Plus className="size-3.5" />
            </button>
            {sale.status === 'OPEN' ? (
              <button
                type="button"
                aria-label={`${copy('Edit item')} ${line.itemNameSnapshot}`}
                title={copy('Edit item')}
                // Same item, new configuration; an item no longer sold is removed instead.
                disabled={isMutating || !sellable}
                onClick={() => onEdit(line)}
                className={stepperClass}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
              disabled={isMutating}
              onClick={() => onRemove(line)}
              className="ml-0.5 flex size-8 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        ) : (
          // Once work is in progress the quantity, removal and configuration of an
          // existing line change only through the audited correction, never directly.
          <span className="px-1 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
            × {quantity(line.quantity)}
          </span>
        )}
        {mode === 'CORRECTION' && sale.status === 'OPEN' ? (
          <button
            type="button"
            aria-label={`Koreksi item ${line.itemNameSnapshot}`}
            disabled={isMutating}
            onClick={() => onStartCorrection(line)}
            className="ml-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 disabled:opacity-40"
          >
            Koreksi item
          </button>
        ) : null}
      </div>
    </li>
  );
}
