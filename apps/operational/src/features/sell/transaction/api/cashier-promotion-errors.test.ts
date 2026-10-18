import { ApiError } from '@digvation/pos-api';
import { describe, expect, it } from 'vitest';

import { cashierTransactionErrorMessage } from './cashier-transaction-errors';

describe('cashier promo code errors', () => {
  it('tells the cashier a member-only promo needs an active member', () => {
    const error = new ApiError(409, 'PROMOTION_MEMBER_REQUIRED', 'raw');
    expect(cashierTransactionErrorMessage(error, 'id-ID')).toBe(
      'Promo ini khusus untuk member aktif.',
    );
    expect(cashierTransactionErrorMessage(error, 'en-US')).toBe(
      'This promotion is for active members only.',
    );
  });
});
