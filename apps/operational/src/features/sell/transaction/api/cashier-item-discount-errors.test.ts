import { ApiError } from '@digvation/pos-api';
import { describe, expect, it } from 'vitest';

import { operationalCopy } from '../../../../app/localization/operational-localization';
import { SETTLEMENT_REFUSAL_COPY } from '../model/settlement-recovery';
import { cashierTransactionErrorMessage } from './cashier-transaction-errors';

describe('item discount errors and recovery copy', () => {
  it('explains a fixed discount above the base item price', () => {
    const error = new ApiError(400, 'SALE_LINE_DISCOUNT_EXCEEDS_BASE_ITEM', 'raw');
    expect(cashierTransactionErrorMessage(error, 'id-ID')).toBe(
      'Nominal diskon melebihi harga dasar item. Item tambahan tidak termasuk dalam batas diskon. Ubah atau hapus diskon sebelum melanjutkan.',
    );
    expect(cashierTransactionErrorMessage(error, 'en-US')).toBe(
      'The fixed discount exceeds the base item price. Additional items do not count toward the discount limit. Change or remove the discount before continuing.',
    );
  });

  it('keeps the generic validation refusal generic', () => {
    const error = new ApiError(400, 'DOMAIN_VALIDATION_ERROR', 'raw');
    expect(cashierTransactionErrorMessage(error, 'en-US')).toBe(
      'Transaction could not be processed. Try again.',
    );
  });

  it('keeps the ordinary unsettled message for SALE_NOT_SETTLED', () => {
    const error = new ApiError(409, 'SALE_NOT_SETTLED', 'raw');
    expect(cashierTransactionErrorMessage(error, 'en-US')).toBe(
      SETTLEMENT_REFUSAL_COPY.REMAINING_PAYMENT,
    );
  });

  it('translates the item discount recovery guidance', () => {
    expect(operationalCopy(SETTLEMENT_REFUSAL_COPY.ITEM_DISCOUNT_REPRICE, 'id-ID')).toBe(
      'Total transaksi perlu diperbarui karena aturan diskon item berubah. Buka diskon item, hapus lalu terapkan kembali diskon yang sesuai. Periksa total terbaru sebelum menyelesaikan pembayaran.',
    );
    expect(
      operationalCopy(SETTLEMENT_REFUSAL_COPY.ITEM_DISCOUNT_REPRICE_NEEDS_AUTHORIZATION, 'id-ID'),
    ).toBe(
      'Total transaksi perlu diperbarui karena aturan diskon item berubah. Minta Manajer atau Pemilik menghapus lalu menerapkan kembali diskon item, kemudian periksa total terbaru sebelum menyelesaikan pembayaran.',
    );
  });
});
