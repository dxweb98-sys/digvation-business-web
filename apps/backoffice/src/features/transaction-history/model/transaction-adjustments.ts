import type { Sale, SaleAdjustment } from '../api/transaction-history-api';
import { activeSaleLines } from './transaction-summary';
import { fromMoneyUnits, toMoneyUnits } from './transaction-payment-composition';

export const ADJUSTMENT_SOURCE_LABELS: Record<SaleAdjustment['source'], string> = {
  PROMOTION: 'Promotion',
  MANUAL_DISCOUNT: 'Manual discount',
};

export const ADJUSTMENT_SCOPE_LABELS: Record<SaleAdjustment['scope'], string> = {
  ITEM: 'Item',
  CATEGORY: 'Category',
  TRANSACTION: 'Whole transaction',
};

export interface AdjustmentPresentation {
  adjustment: SaleAdjustment;
  /** Captured name of the item an item-level adjustment applied to, if any. */
  itemName: string | null;
}

export interface DiscountBreakdown {
  /** Every adjustment that actually took money off, in capture order. */
  entries: AdjustmentPresentation[];
  /** Item-level adjustments per Sale Line id; transaction/category ones never sit under one item. */
  byLine: ReadonlyMap<string, SaleAdjustment[]>;
  /** Sum of the adjustment amounts, computed exactly. */
  total: string;
  /** The breakdown explains the authoritative Sale discount exactly. */
  reconciles: boolean;
  promotionCode: string | null;
}

const effective = (adjustment: SaleAdjustment) => toMoneyUnits(adjustment.actualAmount) > 0n;

/**
 * Explains the authoritative Sale discount with its captured adjustment facts. The aggregate
 * `discountAmount` stays the figure that reaches the total; the breakdown never adds to it.
 */
export function discountBreakdown(
  sale: Pick<Sale, 'adjustments' | 'lines' | 'discountAmount' | 'promotionCode'>,
): DiscountBreakdown {
  const activeLines = activeSaleLines(sale.lines);
  const lineNames = new Map(activeLines.map((line) => [line.id, line.itemNameSnapshot]));
  const adjustments = (sale.adjustments ?? [])
    .filter(effective)
    .filter((adjustment) => !adjustment.saleLineId || lineNames.has(adjustment.saleLineId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const byLine = new Map<string, SaleAdjustment[]>();
  for (const adjustment of adjustments)
    if (adjustment.scope === 'ITEM' && adjustment.saleLineId)
      byLine.set(adjustment.saleLineId, [...(byLine.get(adjustment.saleLineId) ?? []), adjustment]);
  const total = adjustments.reduce(
    (sum, adjustment) => sum + toMoneyUnits(adjustment.actualAmount),
    0n,
  );
  return {
    entries: adjustments.map((adjustment) => ({
      adjustment,
      itemName:
        adjustment.scope === 'ITEM' && adjustment.saleLineId
          ? (lineNames.get(adjustment.saleLineId) ?? null)
          : null,
    })),
    byLine,
    total: fromMoneyUnits(total),
    reconciles: total === toMoneyUnits(sale.discountAmount),
    promotionCode: sale.promotionCode?.trim() || null,
  };
}
