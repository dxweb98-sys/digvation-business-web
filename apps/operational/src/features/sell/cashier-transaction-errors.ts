import { ApiError } from '@digvation/pos-api';

export function cashierTransactionErrorMessage(error: unknown): string {
  if (isApiErrorCode(error, 'PRICE_NOT_FOUND'))
    return 'Harga aktif untuk item, varian, cabang, mata uang, dan waktu saat ini belum dikonfigurasi.';
  if (error instanceof ApiError) {
    return error.requestId ? `${error.message} · Request ${error.requestId}` : error.message;
  }
  return error instanceof Error ? error.message : 'Unexpected transaction error.';
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
