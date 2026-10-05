import { ApiError } from '@digvation/pos-api';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../app/localization/operational-localization';

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
  PROMOTION_MEMBER_REQUIRED: 'This promotion is for active members only.',
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
    return copyForLocale('Complete the remaining payment before finishing this transaction.', locale);
  }
  if (isApiErrorCode(error, 'SALE_LINE_NOT_MUTABLE')) {
    return copyForLocale('This item can no longer be reduced or removed because work has already started.', locale);
  }
  const promotionCopy = error instanceof ApiError ? PROMOTION_ERROR_COPY[error.code] : undefined;
  if (promotionCopy) return copyForLocale(promotionCopy, locale);
  return copyForLocale('Transaction could not be processed. Try again.', locale);
}

/**
 * Stable Runtime codes an item correction can meet, each mapped to what the operator can act on.
 * Only a known, safe code is surfaced; anything else falls back to the caller's generic message.
 */
const CORRECTION_ERROR_COPY: Record<string, string> = {
  CATALOG_ITEM_NOT_FOUND: 'The replacement item is no longer available.',
  CATALOG_VARIANT_NOT_FOUND: 'The selected variant is no longer available.',
  PRICE_NOT_FOUND: 'Item price was not found for this location.',
  CATALOG_PRICE_NOT_FOUND: 'Item price was not found for this location.',
  SALE_LINE_NOT_FOUND: 'The transaction item was not found.',
  SALE_VERSION_CONFLICT: 'The transaction changed. Reload it before correcting.',
  SALE_PAYMENT_OVERAPPLIED: 'The corrected total would be lower than the payments already received.',
  SALE_LINE_NOT_MUTABLE:
    'This item cannot be corrected: its work is completed, a performer is assigned before work started, or a manual price or discount is set.',
  SALE_CORRECTION_REASON_REQUIRED: 'Enter the reason for this correction.',
  SALE_PROGRESSED_ADJUSTMENT_FORBIDDEN: 'Correcting a transaction in progress needs the progressed adjustment permission.',
  PAYMENT_REFUND_PROVIDER_CONFIRMATION_REQUIRED:
    'The lower total must be returned through the payment provider, which is not available here. Ask a supervisor.',
  SALE_NOT_OPEN: 'The transaction is already closed and cannot be changed.',
  SALE_PAYMENT_PENDING: 'A payment is still waiting for confirmation.',
  SERVICE_ADDITIONAL_ITEM_REQUIRED: 'Choose an additional item for every unit that requires one.',
  SERVICE_ADDITIONAL_ITEM_NOT_FOUND: 'An additional item is no longer available.',
  SERVICE_ADDITIONAL_ITEM_IN_FIXED_BOM: 'An additional item is already part of this item.',
  SERVICE_ADDITIONAL_ITEM_DUPLICATE: 'An additional item was chosen twice.',
  ADDITIONAL_ITEM_IS_BASE_ITEM: 'An item cannot be its own additional item.',
  SERVICE_COMPOSITION_COMPONENT_INACTIVE: 'An additional item is no longer active.',
  SERVICE_COMPOSITION_COMPONENT_NOT_FOUND: 'An additional item is no longer available.',
  SERVICE_COMPONENT_PRICE_NOT_FOUND: 'An additional item has no selling price at this location.',
  SERVICE_COMPOSITION_VARIANT_REQUIRED: 'Choose a variant for the additional item.',
  SERVICE_COMPOSITION_VARIANT_INVALID: 'The chosen variant of an additional item is not valid.',
};

export function correctionErrorMessage(error: unknown, fallback: string, locale?: string): string {
  const known = error instanceof ApiError ? CORRECTION_ERROR_COPY[error.code] : undefined;
  return known ? copyForLocale(known, locale) : fallback;
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
