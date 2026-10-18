import { describe, expect, it } from 'vitest';

import type { LoyaltyConfiguration } from './loyalty-api';
import {
  draftFromConfiguration,
  isDraftValid,
  transactionEarningExample,
  updateInputFromDraft,
  validateDraft,
  type LoyaltyConfigurationDraft,
} from './loyalty-configuration-model';

const stored: LoyaltyConfiguration = {
  configured: true,
  earningMode: 'PER_ITEM',
  defaultEarningBehavior: 'FIXED',
  defaultFixedPointsPerUnit: 2,
  transactionAmountPerStep: null,
  transactionPointsPerStep: null,
  earnWhileRedeemingPolicy: 'NO_EARN_WHEN_REDEEMING',
  pointValue: '1000.0000',
  currency: 'IDR',
  version: 4,
};

const draft = (changes: Partial<LoyaltyConfigurationDraft> = {}): LoyaltyConfigurationDraft => ({
  ...draftFromConfiguration(stored),
  ...changes,
});

describe('draftFromConfiguration', () => {
  it('loads an existing tenant as PER_ITEM, not earning while redeeming, with no transaction step', () => {
    expect(draftFromConfiguration(stored)).toEqual({
      pointValue: '1000',
      earningMode: 'PER_ITEM',
      behavior: 'FIXED',
      pointsPerUnit: '2',
      amountPerStep: '',
      pointsPerStep: '',
      earnWhileRedeeming: false,
    });
  });

  it('shows stored transaction settings without trailing zeros and reflects earning while redeeming', () => {
    expect(
      draftFromConfiguration({
        ...stored,
        earningMode: 'TRANSACTION_TOTAL',
        transactionAmountPerStep: '200000.0000',
        transactionPointsPerStep: 1,
        earnWhileRedeemingPolicy: 'EARN_WHEN_REDEEMING',
      }),
    ).toMatchObject({
      earningMode: 'TRANSACTION_TOTAL',
      amountPerStep: '200000',
      pointsPerStep: '1',
      earnWhileRedeeming: true,
    });
  });
});

describe('validateDraft', () => {
  it('needs no transaction settings while PER_ITEM is active', () => {
    expect(isDraftValid(draft())).toBe(true);
  });

  it('requires a complete step while TRANSACTION_TOTAL is active', () => {
    expect(validateDraft(draft({ earningMode: 'TRANSACTION_TOTAL' }))).toEqual({
      amountPerStep: 'Isi nominal lebih dari 0.',
      pointsPerStep: 'Isi bilangan bulat lebih dari 0.',
    });
  });

  it.each(['0', '0.0000', '-5', 'abc', '1e5', '200.000,5'])(
    'rejects a non-positive or malformed amount per step (%s)',
    (amountPerStep) => {
      expect(
        validateDraft(
          draft({ earningMode: 'TRANSACTION_TOTAL', amountPerStep, pointsPerStep: '1' }),
        ).amountPerStep,
      ).toBeDefined();
    },
  );

  it.each(['200000', '50000', '0.5', '0.0001', '1250.75'])(
    'accepts a positive exact amount per step (%s)',
    (amountPerStep) => {
      expect(
        validateDraft(
          draft({ earningMode: 'TRANSACTION_TOTAL', amountPerStep, pointsPerStep: '1' }),
        ).amountPerStep,
      ).toBeUndefined();
    },
  );

  it.each(['0', '-1', '1.5', 'x', ' '])(
    'rejects points per step that are not a positive integer (%s)',
    (pointsPerStep) => {
      expect(
        validateDraft(
          draft({ earningMode: 'TRANSACTION_TOTAL', amountPerStep: '200000', pointsPerStep }),
        ).pointsPerStep,
      ).toBeDefined();
    },
  );

  it('accepts more than one point per step', () => {
    expect(
      isDraftValid(
        draft({ earningMode: 'TRANSACTION_TOTAL', amountPerStep: '50000', pointsPerStep: '2' }),
      ),
    ).toBe(true);
  });

  it('still rejects an invalid inactive-mode value that was entered', () => {
    expect(validateDraft(draft({ amountPerStep: '-1', pointsPerStep: '1' })).amountPerStep).toBe(
      'Isi nominal lebih dari 0.',
    );
  });

  it('keeps point value independent of the transaction step', () => {
    const errors = validateDraft(
      draft({
        pointValue: '',
        earningMode: 'TRANSACTION_TOTAL',
        amountPerStep: '200000',
        pointsPerStep: '1',
      }),
    );
    expect(errors).toEqual({ pointValue: 'Nilai poin wajib diisi.' });
  });

  it('does not ask for points per unit when the default excludes items or the mode is TRANSACTION_TOTAL', () => {
    expect(isDraftValid(draft({ behavior: 'EXCLUDED', pointsPerUnit: '' }))).toBe(true);
    expect(
      isDraftValid(
        draft({
          earningMode: 'TRANSACTION_TOTAL',
          pointsPerUnit: '',
          amountPerStep: '200000',
          pointsPerStep: '1',
        }),
      ),
    ).toBe(true);
  });
});

describe('updateInputFromDraft (the save request)', () => {
  it('sends the complete configuration with the Runtime expectedVersion', () => {
    expect(
      updateInputFromDraft(
        draft({
          earningMode: 'TRANSACTION_TOTAL',
          amountPerStep: '200000',
          pointsPerStep: '1',
          earnWhileRedeeming: true,
        }),
        4,
      ),
    ).toEqual({
      expectedVersion: 4,
      pointValue: '1000',
      earningMode: 'TRANSACTION_TOTAL',
      defaultEarningBehavior: 'FIXED',
      defaultFixedPointsPerUnit: 2,
      earnWhileRedeemingPolicy: 'EARN_WHEN_REDEEMING',
      transactionAmountPerStep: '200000',
      transactionPointsPerStep: 1,
    });
  });

  it('keeps the per-item defaults and the entered transaction values when PER_ITEM is active', () => {
    const input = updateInputFromDraft(draft({ amountPerStep: '50000', pointsPerStep: '2' }), 4);

    expect(input).toMatchObject({
      earningMode: 'PER_ITEM',
      defaultEarningBehavior: 'FIXED',
      defaultFixedPointsPerUnit: 2,
      transactionAmountPerStep: '50000',
      transactionPointsPerStep: 2,
      earnWhileRedeemingPolicy: 'NO_EARN_WHEN_REDEEMING',
    });
  });

  it('omits transaction fields that were never set, so Runtime keeps what it has', () => {
    const input = updateInputFromDraft(draft(), 4);

    expect(input).not.toHaveProperty('transactionAmountPerStep');
    expect(input).not.toHaveProperty('transactionPointsPerStep');
  });

  it('sends zero fixed points when the default excludes items', () => {
    expect(
      updateInputFromDraft(draft({ behavior: 'EXCLUDED', pointsPerUnit: '7' }), 4),
    ).toMatchObject({ defaultEarningBehavior: 'EXCLUDED', defaultFixedPointsPerUnit: 0 });
  });

  it('maps the earn-while-redeeming toggle independently of the mode', () => {
    for (const earningMode of ['PER_ITEM', 'TRANSACTION_TOTAL'] as const) {
      const base = draft({ earningMode, amountPerStep: '200000', pointsPerStep: '1' });
      expect(
        updateInputFromDraft({ ...base, earnWhileRedeeming: true }, 4).earnWhileRedeemingPolicy,
      ).toBe('EARN_WHEN_REDEEMING');
      expect(
        updateInputFromDraft({ ...base, earnWhileRedeeming: false }, 4).earnWhileRedeemingPolicy,
      ).toBe('NO_EARN_WHEN_REDEEMING');
    }
  });
});

describe('transactionEarningExample', () => {
  it('states the rule and an exact multiple in plain language', () => {
    expect(
      transactionEarningExample({ amountPerStep: '200000', pointsPerStep: '1', currency: 'IDR' }),
    ).toEqual({ rule: 'Setiap Rp200.000 → 1 poin', multiple: 'Rp400.000 → 2 poin' });
  });

  it('scales both amount and points by exact integer math', () => {
    expect(
      transactionEarningExample({ amountPerStep: '50000', pointsPerStep: '2', currency: 'IDR' }),
    ).toEqual({ rule: 'Setiap Rp50.000 → 2 poin', multiple: 'Rp100.000 → 4 poin' });
  });

  it('shows only the rule for a fractional step, and nothing for invalid input', () => {
    expect(
      transactionEarningExample({ amountPerStep: '0.5', pointsPerStep: '1', currency: 'IDR' })
        ?.multiple,
    ).toBeNull();
    expect(
      transactionEarningExample({ amountPerStep: '0', pointsPerStep: '1', currency: 'IDR' }),
    ).toBeNull();
    expect(
      transactionEarningExample({ amountPerStep: '200000', pointsPerStep: '1.5', currency: 'IDR' }),
    ).toBeNull();
  });
});
