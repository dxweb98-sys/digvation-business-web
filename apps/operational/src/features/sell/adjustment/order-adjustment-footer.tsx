import { createDecimal } from '@digvation/pos-money';
import { DButton as Button } from '@digvation-labs/ui';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { OrderAdjustmentPreview } from '../transaction/api/cashier-transaction.adapter';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { money } from '../transaction/model/sale-display';
import { saleSettlement } from '../transaction/model/sale-presentation';

/**
 * What the adjustment means for money (a refund, an additional payment, or the total), with the
 * two real outcomes of a draft: Batal discards it, Simpan penyesuaian saves all of it at once.
 */
export function OrderAdjustmentFooter({
  sale,
  preview,
  locale,
  saving,
  canSave,
  onSave,
  onCancel,
}: {
  /** The persisted Sale; its figures apply while nothing is proposed. */
  sale: Sale;
  /** Runtime's impact of the current draft; null while nothing is proposed. */
  preview: OrderAdjustmentPreview | null;
  locale: string;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { copy } = useOperationalLocalization();
  // A draft that leaves no item cancels the transaction: the action says so.
  const voids = Boolean(preview?.settlement.voidRequired);
  const consequence = preview
    ? preview.settlement.refundRequired
      ? {
          label: copy('Refund'),
          amount: preview.settlement.refundAmount,
          tone: 'text-[var(--color-warning)]',
        }
      : preview.settlement.consequence === 'ADDITIONAL_PAYMENT_REQUIRED' &&
          createDecimal(preview.current.paidAmount).greaterThan(createDecimal('0'))
        ? {
            label: copy('Additional payment'),
            amount: preview.settlement.amount,
            tone: 'text-[var(--color-brand)]',
          }
        : voids
          ? // Nothing is paid: there is no figure to settle, only the cancellation itself.
            { label: copy('The transaction will be canceled'), amount: null, tone: '' }
          : {
              label: copy('Total'),
              amount: preview.proposedSale.totalAmount,
              tone: 'text-[var(--color-text)]',
            }
    : persistedConsequence(sale, copy);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0" aria-live="polite">
        <p className="text-[11px] text-[var(--color-text-muted)]">{consequence.label}</p>
        {consequence.amount !== null ? (
          <p className={`text-base font-semibold tabular-nums ${consequence.tone}`}>
            {money(consequence.amount, locale)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          {copy('Cancel')}
        </Button>
        <Button
          {...(voids ? { variant: 'danger' as const } : {})}
          disabled={!canSave || saving}
          loading={saving}
          onClick={onSave}
        >
          {copy(voids ? 'Cancel transaction' : 'Save adjustment')}
        </Button>
      </div>
    </div>
  );
}

/** The persisted Sale's own figure: what was returned, what is still owed, or its total. */
function persistedConsequence(sale: Sale, copy: (value: string) => string) {
  // Both figures come from the Runtime-returned Sale.
  const settlement = saleSettlement(sale);
  const paidAmount = createDecimal(settlement.totalPaid);
  const saleTotal = createDecimal(sale.totalAmount);
  return paidAmount.greaterThan(saleTotal)
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
}
