import type { Sale, SaleCustomer } from './cashier-transaction.types';
import { isPositiveDecimal } from './sale-display';

export function wholePointValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d+)(?:\.0+)?$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function pointQuantity(value: string | null | undefined, locale: string): string {
  const whole = wholePointValue(value);
  if (whole === null) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Number(whole));
}

/**
 * Total points a FINALIZED Sale earned, exactly as Runtime reports its immutable EARN fact. It is
 * the one value shown by Transaction Detail and the receipt; it is never summed from line rows
 * (a TRANSACTION_TOTAL Sale has none) and never shown as +0.
 */
/**
 * The member point facts a receipt states once for the whole Sale: the balance right after this
 * Sale (historical, not today's), what it earned and what it used. Per-line earning stays line detail.
 */
export function receiptPointSummary(
  sale: Pick<Sale, 'status' | 'loyaltyEarning' | 'loyaltySummary' | 'customer'>,
  customer: Pick<SaleCustomer, 'type'> | null,
): {
  balanceAfter: string | null;
  earnedPoints: string | null;
  redeemedPoints: string | null;
} | null {
  if (customer?.type !== 'MEMBER') return null;
  const summary = sale.loyaltySummary;
  if (summary)
    return {
      balanceAfter: summary.balanceAfter,
      earnedPoints: isPositiveDecimal(summary.earnedPoints) ? summary.earnedPoints : null,
      redeemedPoints: isPositiveDecimal(summary.redeemedPoints) ? summary.redeemedPoints : null,
    };
  const earned = saleEarnedPoints(sale);
  return earned ? { balanceAfter: null, earnedPoints: earned, redeemedPoints: null } : null;
}

export function saleEarnedPoints(
  sale: Pick<Sale, 'status' | 'loyaltyEarning' | 'customer'>,
): string | null {
  const earning = sale.loyaltyEarning;
  if (sale.status !== 'FINALIZED' || earning?.state !== 'FINALIZED') return null;
  if (sale.customer && sale.customer.type !== 'MEMBER') return null;
  return isPositiveDecimal(earning.pointsEarned) ? earning.pointsEarned : null;
}
