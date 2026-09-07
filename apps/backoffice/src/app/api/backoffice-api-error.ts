import { readStoredBackofficeLocale } from '../localization/backoffice-localization';

export interface BackofficeApiError {
  status: number | null;
  code: string;
  safeMessage: string;
}

const safeMessages = {
  id: {
    NOT_FOUND: 'Data yang diminta tidak ditemukan.', VERSION_CONFLICT: 'Data telah berubah. Muat ulang lalu coba lagi.', DUPLICATE_RESOURCE: 'Data dengan nilai tersebut sudah digunakan.', INACTIVE_REFERENCE: 'Data referensi yang dipilih sudah tidak aktif.', DOMAIN_VALIDATION_ERROR: 'Data yang dimasukkan tidak valid.', ACCOUNT_IN_USE: 'Akun masih digunakan oleh rute pembayaran aktif. Nonaktifkan atau pindahkan rute terlebih dahulu.', ROUTE_ACCOUNT_TYPE_MISMATCH: 'Jenis akun tidak sesuai dengan metode pembayaran.', SERVICE_UNAVAILABLE: 'Layanan sedang tidak tersedia. Coba beberapa saat lagi.', PRICE_AMOUNT_INVALID: 'Harga yang dimasukkan tidak valid.', PRICE_EFFECTIVE_TIME_INVALID: 'Waktu mulai harga tidak valid.', PRICE_EFFECTIVE_PERIOD_INVALID: 'Periode harga tidak valid.', EFFECTIVE_PERIOD_OVERLAP: 'Jadwal harga bertabrakan dengan harga lain.', PRICE_CHANGE_CONFLICT: 'Harga telah berubah. Muat ulang lalu coba lagi.', ITEM_ARCHIVED: 'Item yang diarsipkan tidak dapat diubah harganya.', UNKNOWN_API_ERROR: 'Terjadi kesalahan. Silakan coba lagi.',
  },
  en: {
    NOT_FOUND: 'The requested data was not found.', VERSION_CONFLICT: 'The data has changed. Reload and try again.', DUPLICATE_RESOURCE: 'A record already uses that value.', INACTIVE_REFERENCE: 'The selected reference is no longer active.', DOMAIN_VALIDATION_ERROR: 'The submitted data is invalid.', ACCOUNT_IN_USE: 'The account is used by an active payment route. Deactivate or move the route first.', ROUTE_ACCOUNT_TYPE_MISMATCH: 'The account type is not compatible with the payment method.', SERVICE_UNAVAILABLE: 'The service is currently unavailable. Please try again shortly.', PRICE_AMOUNT_INVALID: 'The entered price is invalid.', PRICE_EFFECTIVE_TIME_INVALID: 'The price start time is invalid.', PRICE_EFFECTIVE_PERIOD_INVALID: 'The price period is invalid.', EFFECTIVE_PERIOD_OVERLAP: 'The price schedule overlaps another price.', PRICE_CHANGE_CONFLICT: 'The price has changed. Reload and try again.', ITEM_ARCHIVED: 'An archived item cannot have its price changed.', UNKNOWN_API_ERROR: 'Something went wrong. Please try again.',
  },
} as const;

export function normalizeBackofficeApiError(
  error: unknown,
  fallback?: string,
): BackofficeApiError {
  const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const status = typeof value.status === 'number' ? value.status : null;
  const code = typeof value.code === 'string' ? value.code : 'UNKNOWN_API_ERROR';
  const messages = safeMessages[readStoredBackofficeLocale()];
  return { status, code, safeMessage: messages[code as keyof typeof messages] ?? fallback ?? messages.UNKNOWN_API_ERROR };
}

export function isBackofficeSessionExpired(error: unknown): boolean {
  return normalizeBackofficeApiError(error).status === 401;
}
