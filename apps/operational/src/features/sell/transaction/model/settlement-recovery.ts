import { createDecimal } from '@digvation/pos-money';

import type { Payment, SaleAdjustment, SaleLine } from './cashier-transaction.types';
import { paymentProgress } from './sale-presentation';

/**
 * Why Runtime refused to finish a transaction as unsettled, read from the transaction as Runtime
 * returns it right after the refusal. Runtime stays the only authority on the amounts; this only
 * decides which guidance the cashier sees.
 *
 * - `REMAINING_PAYMENT`: an amount is still open, so the ordinary payment flow applies.
 * - `ITEM_DISCOUNT_REPRICE`: the stored transaction still reads as fully paid, yet Runtime refused
 *   it, and an item discount sits on an item with additional items. Item discounts no longer
 *   reduce additional items, so the stored total is out of date until the discount is applied
 *   again. `ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION` is the same case for an account that may
 *   not change discounts.
 * - `PROMOTION_REPRICE`: the same stale total where an item or category Promotion sits on an item
 *   with additional items. Item Promotions no longer reduce additional items; Runtime's existing
 *   Promotion refresh re-prices the transaction (it also re-prices any item discount), so the
 *   cashier is offered that action. `PROMOTION_REPRICE_NEEDS_AUTHORIZATION` is the same case for an
 *   account that may not update the transaction. Both need the Promotions capability.
 * - `UNSETTLED`: anything else; the generic settlement guidance applies.
 */
export type SettlementRefusal =
  | 'REMAINING_PAYMENT'
  | 'ITEM_DISCOUNT_REPRICE'
  | 'ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION'
  | 'PROMOTION_REPRICE'
  | 'PROMOTION_REPRICE_NEEDS_AUTHORIZATION'
  | 'UNSETTLED';

/** The permission Runtime requires to apply or remove an item discount. */
export const SALE_DISCOUNT_PERMISSION = 'sales:discount';
/** The permission and capability Runtime requires to refresh a transaction's Promotions. */
export const SALE_UPDATE_PERMISSION = 'sales:update';
export const PROMOTIONS_CAPABILITY = 'PROMOTIONS';

type RecoverySale = {
  totalAmount: string;
  payments: ReadonlyArray<Pick<Payment, 'status' | 'appliedAmount'>>;
  lines: ReadonlyArray<
    Pick<SaleLine, 'id' | 'removedAt' | 'discountType' | 'compositionComponents'>
  >;
  adjustments?: ReadonlyArray<Pick<SaleAdjustment, 'source' | 'saleLineId'>>;
};

const hasSaleSelectedAddition = (line: RecoverySale['lines'][number]) =>
  (line.compositionComponents ?? []).some(
    (component) => component.componentSource === 'SALE_SELECTED',
  );

/** An active line with sale-selected additional items carries an item or category Promotion. */
export function hasPromotedLineWithAdditions(
  sale: Pick<RecoverySale, 'lines' | 'adjustments'>,
): boolean {
  return sale.lines.some(
    (line) =>
      line.removedAt === null &&
      hasSaleSelectedAddition(line) &&
      (sale.adjustments ?? []).some(
        (adjustment) => adjustment.source === 'PROMOTION' && adjustment.saleLineId === line.id,
      ),
  );
}

/** An active line carries a manual item discount and at least one sale-selected additional item. */
export function hasDiscountedLineWithAdditions(sale: Pick<RecoverySale, 'lines'>): boolean {
  return sale.lines.some(
    (line) =>
      line.removedAt === null && line.discountType !== null && hasSaleSelectedAddition(line),
  );
}

export function settlementRefusal(
  sale: RecoverySale,
  permissions: readonly string[],
  capabilities: readonly string[] = [],
): SettlementRefusal {
  const progress = paymentProgress(sale);
  if (createDecimal(progress.remainingAmount).greaterThan(0)) return 'REMAINING_PAYMENT';
  if (createDecimal(progress.pendingAmount).greaterThan(0)) return 'UNSETTLED';
  // Without the Promotions capability Runtime refuses the refresh for every account, so no
  // Promotion guidance is offered at all and the transaction keeps its non-Promotion guidance.
  if (capabilities.includes(PROMOTIONS_CAPABILITY) && hasPromotedLineWithAdditions(sale))
    return permissions.includes(SALE_UPDATE_PERMISSION)
      ? 'PROMOTION_REPRICE'
      : 'PROMOTION_REPRICE_NEEDS_AUTHORIZATION';
  if (!hasDiscountedLineWithAdditions(sale)) return 'UNSETTLED';
  return permissions.includes(SALE_DISCOUNT_PERMISSION)
    ? 'ITEM_DISCOUNT_REPRICE'
    : 'ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION';
}

/** Source copy for each refusal; translated through the Operational copy dictionary. */
export const SETTLEMENT_REFUSAL_COPY: Record<SettlementRefusal, string> = {
  REMAINING_PAYMENT: 'Complete the remaining payment before finishing this transaction.',
  ITEM_DISCOUNT_REPRICE:
    'The transaction total needs updating because the item discount rule changed. Open the item discount, remove it, then apply the correct discount again. Check the new total before completing the payment.',
  ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION:
    'The transaction total needs updating because the item discount rule changed. Ask a Manager or Owner to remove the item discount and apply it again, then check the new total before completing the payment.',
  PROMOTION_REPRICE:
    'The transaction total needs updating because the item promotion rule changed. Select Update total, then check the new total before completing the payment.',
  PROMOTION_REPRICE_NEEDS_AUTHORIZATION:
    'The transaction total needs updating because the item promotion rule changed. Ask a Manager or Owner to update the total, then check the new total before completing the payment.',
  UNSETTLED: 'Complete the remaining payment before finishing this transaction.',
};
