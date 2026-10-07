import { createDecimal } from '@digvation/pos-money';
import { DButton as Button } from '@digvation-labs/ui';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { money } from '../transaction/model/sale-display';
import { saleSettlement } from '../transaction/model/sale-presentation';

/**
 * What the adjustment means for money so far (a refund, an additional payment, or the total),
 * with closing the adjustment. Each change is already recorded, so saving only closes.
 */
export function OrderAdjustmentFooter({
  sale,
  locale,
  changed,
  mutating,
  onClose,
}: {
  sale: Sale;
  locale: string;
  /** Any line was added, removed or changed in quantity since the dialog opened. */
  changed: boolean;
  mutating: boolean;
  onClose: () => void;
}) {
  const { copy } = useOperationalLocalization();
  // Both figures come from the Runtime-returned Sale after each command.
  const settlement = saleSettlement(sale);
  const paidAmount = createDecimal(settlement.totalPaid);
  const saleTotal = createDecimal(sale.totalAmount);
  const consequence = paidAmount.greaterThan(saleTotal)
    ? {
        label: copy('Refund'),
        amount: paidAmount.minus(saleTotal).toFixed(4),
        tone: 'text-[var(--color-warning)]',
      }
    : paidAmount.greaterThan(createDecimal('0')) && saleTotal.greaterThan(paidAmount)
      ? {
          label: copy('Additional payment'),
          amount: settlement.balanceDue,
          tone: 'text-[var(--color-brand)]',
        }
      : { label: copy('Total'), amount: sale.totalAmount, tone: 'text-[var(--color-text)]' };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0" aria-live="polite">
        <p className="text-[11px] text-[var(--color-text-muted)]">{consequence.label}</p>
        <p className={`text-base font-semibold tabular-nums ${consequence.tone}`}>
          {money(consequence.amount, locale)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {changed ? null : (
          <Button variant="ghost" onClick={onClose}>
            {copy('Cancel')}
          </Button>
        )}
        <Button disabled={mutating} onClick={onClose}>
          {copy('Save adjustment')}
        </Button>
      </div>
    </div>
  );
}
