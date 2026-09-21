import { ApiError } from '@digvation/pos-api';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../app/localization/operational-localization';

function copyForLocale(value: string, locale?: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

/** Runtime promotion eligibility codes returned when a promo code is submitted. */
const PROMOTION_ERROR_COPY: Record<string, string> = {
  PROMOTION_NOT_FOUND: 'Promo code was not found.',
  PROMOTION_DISABLED: 'This promotion is currently disabled.',
  PROMOTION_NOT_STARTED: 'This promotion has not started yet.',
  PROMOTION_EXPIRED: 'This promotion has ended.',
  PROMOTION_LOCATION_MISMATCH: 'This promo code is not valid at this location.',
  PROMOTION_CURRENCY_MISMATCH: 'This promo code is not valid for the transaction currency.',
  PROMOTION_MINIMUM_NOT_MET: 'The minimum purchase has not been met.',
  PROMOTION_TARGET_NOT_ELIGIBLE: 'This promo code does not apply to the items in this transaction.',
};

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
    return copyForLocale('Refund required', locale);
  }
  if (isApiErrorCode(error, 'SALE_NOT_SETTLED')) {
    return copyForLocale(
      'Complete the remaining payment before finishing this transaction.',
      locale,
    );
  }
  if (isApiErrorCode(error, 'SALE_LINE_NOT_MUTABLE')) {
    return copyForLocale(
      'This item can no longer be reduced or removed because work has already started.',
      locale,
    );
  }
  const promotionCopy = error instanceof ApiError ? PROMOTION_ERROR_COPY[error.code] : undefined;
  if (promotionCopy) return copyForLocale(promotionCopy, locale);
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
