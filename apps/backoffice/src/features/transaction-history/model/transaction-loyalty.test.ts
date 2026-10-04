import { describe, expect, it } from 'vitest';

import { membershipPresentation } from './transaction-loyalty';
import { testLine, testSale } from './transaction-test-fixtures';

const member = { type: 'MEMBER' as const, name: 'Andini Puspitasari' };

describe('membershipPresentation', () => {
  it('is absent for a non-member transaction', () => {
    expect(membershipPresentation(testSale())).toBeNull();
    expect(
      membershipPresentation(testSale({ customer: { type: 'NON_MEMBER', name: 'Walk-in' } })),
    ).toBeNull();
  });

  it('shows a member who earned points without redeeming any', () => {
    const result = membershipPresentation(
      testSale({
        status: 'FINALIZED',
        customer: member,
        loyaltyEarning: { state: 'FINALIZED', pointsEarned: '71.0000' },
        loyaltySummary: {
          earnedPoints: '71.0000',
          redeemedPoints: '0.0000',
          balanceAfter: '1240.0000',
        },
      }),
    );
    expect(result).toEqual({
      memberName: 'Andini Puspitasari',
      redeemed: null,
      earned: { kind: 'EARNED', points: '71.0000' },
      balanceAfter: '1240.0000',
      reversed: false,
    });
  });

  it('shows redeemed points and their monetary value', () => {
    const result = membershipPresentation(
      testSale({
        status: 'FINALIZED',
        customer: member,
        loyaltyRedemption: {
          membershipId: 'm-1',
          points: '500.0000',
          pointValue: '100.0000',
          amount: '50000.0000',
        },
        loyaltyEarning: { state: 'FINALIZED', pointsEarned: '20.0000' },
        loyaltySummary: {
          earnedPoints: '20.0000',
          redeemedPoints: '500.0000',
          balanceAfter: '760.0000',
        },
      }),
    );
    expect(result).toMatchObject({
      redeemed: { points: '500.0000', amount: '50000.0000' },
      earned: { kind: 'EARNED', points: '20.0000' },
      balanceAfter: '760.0000',
    });
  });

  it('never presents a finalized Sale as a preview, nor an OPEN preview as earned', () => {
    const finalized = membershipPresentation(
      testSale({
        status: 'FINALIZED',
        customer: member,
        loyaltyEarning: null,
        lines: [testLine({ loyaltyEarning: { state: 'FINALIZED', pointsEarned: '5.0000' } })],
      }),
    );
    expect(finalized!.earned).toEqual({ kind: 'NONE' });
    const open = membershipPresentation(
      testSale({
        status: 'OPEN',
        customer: member,
        loyaltySummary: null,
        lines: [
          testLine({ loyaltyEarning: { state: 'PREVIEW', pointsEarned: '2.5000' } }),
          testLine({ id: 'b', loyaltyEarning: { state: 'PREVIEW', pointsEarned: '1.2500' } }),
        ],
      }),
    );
    expect(open).toMatchObject({
      earned: { kind: 'ESTIMATED', points: '3.7500' },
      balanceAfter: null,
    });
  });

  it('flags a reversed Sale so its original point activity reads as compensated history', () => {
    const result = membershipPresentation(
      testSale({
        status: 'FINALIZED',
        customer: member,
        reversal: { reason: 'Komplain', reversedAt: '2026-10-01T08:00:00.000Z' },
        loyaltyEarning: { state: 'FINALIZED', pointsEarned: '71.0000' },
      }),
    );
    expect(result).toMatchObject({ reversed: true, earned: { kind: 'EARNED', points: '71.0000' } });
  });
});
