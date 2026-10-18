import { createDecimal } from '@digvation/pos-money';
import type { Ref } from 'react';

import type { ReplaceLinePreview } from '../transaction/api/cashier-transaction.adapter';
import { money, quantity } from '../transaction/model/sale-display';

/** One labelled amount of an adjustment's or a correction's impact. */
export function SettlementFigure({
  label,
  value,
  className = '',
  locale,
}: {
  label: string;
  value: string;
  className?: string;
  locale: string;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{money(value, locale)}</dd>
    </div>
  );
}

/** Runtime-calculated impact of a correction before it is saved: lines, totals, and consequence. */
export function CorrectionImpactPreview({
  preview,
  locale,
  ref,
}: {
  preview: ReplaceLinePreview;
  locale: string;
  ref: Ref<HTMLElement>;
}) {
  return (
    <section
      ref={ref}
      aria-label="Dampak koreksi"
      aria-live="polite"
      className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm"
    >
      <ul
        aria-label="Hasil koreksi"
        className="mb-3 space-y-2 border-b border-[var(--color-border)] pb-3"
      >
        {preview.replacements.map((replacement, index) => (
          <li key={`${replacement.catalogItemId}-${index}`} className="text-xs">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold text-[var(--color-text)]">
                {replacement.itemName}
                {replacement.variantName ? ` · ${replacement.variantName}` : ''}
                <span className="block font-normal tabular-nums text-[var(--color-text-muted)]">
                  {quantity(replacement.quantity)} × {money(replacement.unitAmount, locale)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {money(replacement.grossAmount, locale)}
              </span>
            </div>
            {replacement.additions.map((addition) => (
              <p key={addition.name} className="mt-0.5 pl-3 text-[var(--color-text-muted)]">
                + {addition.name} × {quantity(addition.quantity)} · {money(addition.amount, locale)}
              </p>
            ))}
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 text-[var(--color-text-muted)]">
        <SettlementFigure
          label="Total sebelumnya"
          value={preview.currentTotalAmount}
          locale={locale}
        />
        <SettlementFigure
          label="Total setelah koreksi"
          value={preview.correctedTotalAmount}
          className="font-semibold text-[var(--color-text)]"
          locale={locale}
        />
        <SettlementFigure
          label="Sudah dibayar"
          value={preview.netSuccessfulPaidAmount}
          locale={locale}
        />
      </dl>
      <div className="mt-2 space-y-1.5 border-t border-[var(--color-border)] pt-2">
        {/* Runtime's consequence: what remains to pay, or what is returned as a new refund. */}
        {preview.refundAmount &&
        createDecimal(preview.refundAmount).greaterThan(createDecimal('0')) ? (
          <dl>
            <SettlementFigure
              label="Dikembalikan ke pelanggan"
              value={preview.refundAmount}
              className="font-semibold text-[var(--color-warning)]"
              locale={locale}
            />
          </dl>
        ) : (
          <dl>
            <SettlementFigure
              label="Sisa pembayaran"
              value={preview.remainingPaymentAmount}
              className="font-semibold text-[var(--color-text)]"
              locale={locale}
            />
          </dl>
        )}
      </div>
    </section>
  );
}
