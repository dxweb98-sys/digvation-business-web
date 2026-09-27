import { ApiError } from '@digvation/pos-api';
import { describe, expect, it } from 'vitest';

import { correctionErrorMessage } from './cashier-transaction-errors';

const fallback = 'Koreksi belum dapat disimpan. Muat ulang transaksi lalu coba lagi.';
const messageFor = (code: string) => correctionErrorMessage(new ApiError(404, code, 'raw'), fallback, 'id-ID');

describe('correctionErrorMessage', () => {
  it('names what is missing for each stable Runtime code, in Indonesian', () => {
    expect(messageFor('CATALOG_ITEM_NOT_FOUND')).toBe('Item pengganti tidak lagi tersedia.');
    expect(messageFor('CATALOG_VARIANT_NOT_FOUND')).toBe('Varian yang dipilih sudah tidak tersedia.');
    expect(messageFor('PRICE_NOT_FOUND')).toBe('Harga item tidak ditemukan untuk lokasi ini.');
    expect(messageFor('SALE_LINE_NOT_FOUND')).toBe('Baris transaksi tidak ditemukan.');
    expect(messageFor('SALE_VERSION_CONFLICT')).toBe(
      'Transaksi telah berubah. Muat ulang sebelum melakukan koreksi.',
    );
    expect(messageFor('SALE_PAYMENT_OVERAPPLIED')).toBe(
      'Total setelah koreksi lebih kecil dari pembayaran yang sudah diterima.',
    );
    expect(messageFor('SERVICE_COMPOSITION_COMPONENT_INACTIVE')).toBe(
      'Ada item tambahan yang sudah tidak aktif.',
    );
  });

  it('never surfaces the raw message, and keeps the safe fallback for unknown or non-API errors', () => {
    expect(correctionErrorMessage(new ApiError(404, 'NOT_FOUND', 'Requested resource was not found'), fallback)).toBe(
      fallback,
    );
    expect(correctionErrorMessage(new Error('SQL exploded'), fallback)).toBe(fallback);
    expect(messageFor('CATALOG_ITEM_NOT_FOUND')).not.toContain('raw');
  });
});
