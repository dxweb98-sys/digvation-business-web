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
