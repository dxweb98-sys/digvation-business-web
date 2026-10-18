import type { Sale } from '../api/transaction-history-api';
import { activeSaleLines } from './transaction-summary';

/** Points are exact decimals with up to four fraction digits; add them exactly. */
const SCALE = 4n;
const toPointUnits = (points: string) => {
  const [whole = '0', fraction = ''] = points.trim().split('.');
  return BigInt(whole || '0') * 10n ** SCALE + BigInt(fraction.padEnd(4, '0').slice(0, 4) || '0');
};
const fromPointUnits = (units: bigint) =>
  `${units / 10n ** SCALE}.${(units % 10n ** SCALE).toString().padStart(4, '0')}`;
const hasPoints = (points: string | null | undefined) => Boolean(points && /[1-9]/.test(points));

export type PointsEarnedState =
  /** Immutable earning of a finalized Sale. */
  | { kind: 'EARNED'; points: string }
  /** Current-rule preview of an OPEN Sale; never presented as earned. */
  | { kind: 'ESTIMATED'; points: string }
  | { kind: 'NONE' };

export interface MembershipPresentation {
  memberName: string;
  redeemed: { points: string; amount: string } | null;
  earned: PointsEarnedState;
  /** Authoritative balance right after the finalized Sale, when history provides it. */
  balanceAfter: string | null;
  /** The Sale was reversed; its point effects were compensated by Runtime. */
  reversed: boolean;
}

/**
 * Member and point facts of a transaction, read from the Sale contract only; no Loyalty rule
 * is evaluated here. `null` for a non-member transaction.
 */
export function membershipPresentation(
  sale: Pick<
    Sale,
    | 'status'
    | 'customer'
    | 'loyaltyRedemption'
    | 'loyaltyEarning'
    | 'loyaltySummary'
    | 'lines'
    | 'reversal'
  >,
): MembershipPresentation | null {
  if (sale.customer?.type !== 'MEMBER') return null;
  const redemption = sale.loyaltyRedemption;
  const finalizedEarned = sale.loyaltyEarning?.pointsEarned ?? sale.loyaltySummary?.earnedPoints;
  const previews =
    sale.status === 'OPEN'
      ? activeSaleLines(sale.lines)
          .map((line) => line.loyaltyEarning)
          .filter((earning) => earning?.state === 'PREVIEW' && hasPoints(earning.pointsEarned))
      : [];
  const earned: PointsEarnedState =
    sale.status === 'FINALIZED' && hasPoints(finalizedEarned)
      ? { kind: 'EARNED', points: finalizedEarned! }
      : previews.length
        ? {
            kind: 'ESTIMATED',
            points: fromPointUnits(
              previews.reduce((sum, earning) => sum + toPointUnits(earning!.pointsEarned), 0n),
            ),
          }
        : { kind: 'NONE' };
  return {
    memberName: sale.customer.name,
    redeemed:
      redemption && hasPoints(redemption.points)
        ? { points: redemption.points, amount: redemption.amount }
        : null,
    earned,
    balanceAfter: sale.status === 'FINALIZED' ? (sale.loyaltySummary?.balanceAfter ?? null) : null,
    reversed: Boolean(sale.reversal),
  };
}
