import { createDecimal } from '@digvation/pos-money';
import { Pencil, ShoppingBag } from 'lucide-react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { CartDisplayLine } from '../cart/cart-draft';
import { CartLineBreakdown } from '../cart/cart-line-breakdown';
import { isPositiveDecimal, quantity } from '../transaction/model/sale-display';
import { lineDiscountPercentage } from '../transaction/model/sale-presentation';
import { DiscountDetailsContent, DiscountInfoTooltip } from '../transaction/ui/discount-details';

type Format = (amount: string) => string;

/** The lines being paid, with their discounts and selected additions, and a way back to the order. */
export function PaymentOrderDetails({
  lines,
  gross,
  locale,
  format,
  onEditOrder,
  isSubmitting,
}: {
  lines: readonly CartDisplayLine[];
  gross: string;
  locale: string;
  format: Format;
  onEditOrder?: () => void;
  isSubmitting: boolean;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <section className="pos-pay-section">
      <div className="pos-pay-section__head border-b border-[var(--color-border)]">
        <div className="pos-pay-section__title">
          <ShoppingBag
            className="size-4 shrink-0 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
          <span className="truncate">{copy('Order details')}</span>
          <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
            {lines.length} {copy('items')}
          </span>
          {onEditOrder ? (
            <button
              type="button"
              onClick={onEditOrder}
              disabled={isSubmitting}
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/8 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="size-3" aria-hidden="true" />
              {copy('Return to order')}
            </button>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="pos-pay-eyebrow">{copy('Subtotal')}</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-text)]">
            {format(gross)}
          </p>
        </div>
      </div>
      <div className="divide-y divide-[var(--color-border)]/70 bg-[var(--color-surface)]">
        {lines.map((line) => {
          const discountPercentage = lineDiscountPercentage(line);
          const discounted = isPositiveDecimal(line.lineDiscountAmount);
          const discountedLineAmount = discounted
            ? createDecimal(line.totalAmount)
                .minus(createDecimal(line.lineDiscountAmount))
                .toFixed(4)
            : line.totalAmount;
          const promotionTooltip = (
            <DiscountDetailsContent
              locale={locale}
              details={{
                source: 'PROMOTION',
                scope: null,
                name: line.promotion?.name ?? null,
                percentage: discountPercentage,
                effectiveFrom: line.promotion?.effectiveFrom ?? null,
                effectiveUntil: line.promotion?.effectiveUntil ?? null,
                reason: null,
              }}
            />
          );
          return (
            <div key={line.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {line.itemNameSnapshot}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-[var(--color-text-muted)]">
                    {quantity(line.quantity)} × {format(line.effectiveUnitPrice)}
                  </p>
                  {discounted ? (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-danger)]">
                      <DiscountInfoTooltip
                        label={copy('Discount information')}
                        content={promotionTooltip}
                      />
                      <span>
                        {copy('Discount')} −{format(line.lineDiscountAmount)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  {discounted ? (
                    <p className="text-[10px] font-medium text-[var(--color-danger)] line-through decoration-[1.5px]">
                      {format(line.totalAmount)}
                    </p>
                  ) : null}
                  <p className="text-sm font-bold text-[var(--color-text)]">
                    {format(discountedLineAmount)}
                  </p>
                </div>
              </div>
              <CartLineBreakdown
                line={line}
                heading={`${copy('Additional items')}: ${line.itemNameSnapshot}`}
                baseLabel={copy('Item price')}
                unitLabel={(index) => `${copy('Unit')} ${index}`}
                format={format}
                formatQuantity={quantity}
                performedByLabel={copy('Performed by')}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
