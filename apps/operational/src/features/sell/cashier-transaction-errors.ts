import { ApiError } from '@digvation/pos-api';

export function cashierTransactionErrorMessage(error: unknown): string {
  if (
    isApiErrorCode(error, 'PRICE_NOT_FOUND') ||
    isApiErrorCode(error, 'CATALOG_PRICE_NOT_FOUND')
  ) {
    return 'Harga item belum tersedia untuk pilihan ini.';
  }
  if (isApiErrorCode(error, 'SALE_VERSION_CONFLICT')) {
    return 'Transaksi telah berubah. Tinjau data terbaru sebelum melanjutkan.';
  }
  return 'Transaksi tidak dapat diproses. Coba lagi.';
}

export function isApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

export function isSaleVersionConflict(error: unknown): boolean {
  return isApiErrorCode(error, 'SALE_VERSION_CONFLICT');
}

export function isKnownApiFailure(error: unknown): boolean {
  return error instanceof ApiError;
}
