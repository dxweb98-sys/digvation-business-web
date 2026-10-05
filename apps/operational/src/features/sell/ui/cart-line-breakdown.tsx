import { createDecimal } from '@digvation/pos-money';

import type { CartDisplayAddition, CartDisplayLine } from '../model/cart-draft';

interface CartLineBreakdownProps {
  line: Pick<
    CartDisplayLine,
    'additions' | 'units' | 'baseUnitPrice' | 'quantity' | 'totalAmount' | 'itemNameSnapshot'
  >;
  /** Formats an amount; the same money formatter the surrounding surface already uses. */
  format: (amount: string) => string;
  formatQuantity: (quantity: string) => string;
  baseLabel: string;
  unitLabel: (index: number) => string;
  heading: string;
  /** "Dikerjakan oleh"; shown under an addition someone performs. */
  performedByLabel?: string;
}

function AdditionRows({
  additions,
  format,
  formatQuantity,
  performedByLabel,
}: {
  additions: readonly CartDisplayAddition[];
  format: (amount: string) => string;
  formatQuantity: (quantity: string) => string;
  performedByLabel?: string | undefined;
}) {
  return (
    <>
      {additions.map((addition) => (
        <li key={addition.label} className="flex items-start justify-between gap-3">
          <span className="min-w-0 break-words">
            + {addition.label}
            <span className="block tabular-nums text-[var(--color-text-muted)]">
              {formatQuantity(addition.quantity)} × {format(addition.unitPrice)}
            </span>
            {performedByLabel && addition.performers?.some((performer) => performer.name) ? (
              <span className="block break-words text-[var(--color-text-muted)]">
                {performedByLabel}{' '}
                {addition.performers
                  .map((performer) => performer.name)
                  .filter(Boolean)
                  .join(', ')}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 tabular-nums">{format(addition.amount)}</span>
        </li>
      ))}
    </>
  );
}

/**
 * How the amount of a line is composed: the base item plus the additions chosen in this
 * transaction. When the units of a line carry different additions each unit is listed on its own,
 * with its own exact amount. Everything shown comes from the line; nothing is recomputed here
 * except taking the additions out of the authoritative line amount to name the base.
 */
export function CartLineBreakdown({
  line,
  format,
  formatQuantity,
  baseLabel,
  unitLabel,
  heading,
  performedByLabel,
}: CartLineBreakdownProps) {
  if (line.units?.length) {
    return (
      <ol
        aria-label={heading}
        className="mt-2 space-y-2 border-l-2 border-[var(--color-border)] pl-2.5 text-[11px]"
      >
        {line.units.map((unit) => (
          <li key={unit.index}>
            <div className="flex items-start justify-between gap-3 font-semibold text-[var(--color-text)]">
              <span>{unitLabel(unit.index)}</span>
              <span className="shrink-0 tabular-nums">{format(unit.amount)}</span>
            </div>
            <ul className="mt-0.5 space-y-0.5 text-[var(--color-text-muted)]">
              <li className="flex items-start justify-between gap-3">
                <span>{baseLabel}</span>
                <span className="shrink-0 tabular-nums">
                  {format(
                    createDecimal(unit.amount)
                      .minus(
                        unit.additions.reduce((sum, a) => sum.plus(a.amount), createDecimal('0')),
                      )
                      .toFixed(4),
                  )}
                </span>
              </li>
              <AdditionRows
                additions={unit.additions}
                format={format}
                formatQuantity={formatQuantity}
                performedByLabel={performedByLabel}
              />
            </ul>
          </li>
        ))}
      </ol>
    );
  }
  if (!line.additions?.length) return null;
  const baseAmount = line.additions
    .reduce((rest, addition) => rest.minus(addition.amount), createDecimal(line.totalAmount))
    .toFixed(4);
  return (
    <ul
      aria-label={heading}
      className="mt-2 space-y-0.5 border-l-2 border-[var(--color-border)] pl-2.5 text-[11px] text-[var(--color-text-muted)]"
    >
      <li className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          {baseLabel}
          {line.baseUnitPrice ? (
            <span className="block tabular-nums">
              {formatQuantity(line.quantity)} × {format(line.baseUnitPrice)}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 tabular-nums">{format(baseAmount)}</span>
      </li>
      <AdditionRows
        additions={line.additions}
        format={format}
        formatQuantity={formatQuantity}
        performedByLabel={performedByLabel}
      />
    </ul>
  );
}
