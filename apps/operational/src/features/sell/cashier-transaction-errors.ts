import { ApiError } from '@digvation/pos-api';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';

function copyForLocale(value: string, locale?: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

export function cashierTransactionErrorMessage(error: unknown, locale?: string): string {
  if (
    isApiErrorCode(error, 'PRICE_NOT_FOUND') ||
    isApiErrorCode(error, 'CATALOG_PRICE_NOT_FOUND')
  ) {
    return copyForLocale('Item price is unavailable for this selection.', locale);
  }
  if (isApiErrorCode(error, 'SALE_VERSION_CONFLICT')) {
    return copyForLocale('Transaction changed. Review the latest data before continuing.', locale);
  }
  if (isApiErrorCode(error, 'PAYMENT_AMOUNT_EXCEEDS_OUTSTANDING')) {
    return copyForLocale('Payment amount exceeds the remaining balance.', locale);
  }
  if (isApiErrorCode(error, 'SALE_PAYMENT_OVERAPPLIED')) {
    return copyForLocale('Refund is required before reducing the transaction below the amount already paid.', locale);
  }
  if (isApiErrorCode(error, 'SALE_NOT_SETTLED')) {
    return copyForLocale('Complete the remaining payment before finishing this transaction.', locale);
  }
  if (isApiErrorCode(error, 'SALE_LINE_NOT_MUTABLE')) {
    return copyForLocale('This item can no longer be reduced or removed because work has already started.', locale);
  }
  return copyForLocale('Transaction could not be processed. Try again.', locale);
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
