import Decimal from 'decimal.js';

export type DecimalString = string & { readonly __decimalStringBrand: unique symbol };

export function createDecimal(value: string): Decimal {
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    throw new Error('Invalid decimal string.');
  }

  return new Decimal(value);
}

export function addDecimalStrings(left: string, right: string): string {
  return createDecimal(left).plus(createDecimal(right)).toFixed();
}

export function subtractDecimalStrings(left: string, right: string): string {
  return createDecimal(left).minus(createDecimal(right)).toFixed();
}

export function compareDecimalStrings(left: string, right: string): number {
  return createDecimal(left).comparedTo(createDecimal(right));
}

export function formatMoney(
  amount: string,
  currency: string,
  locale: string,
  maximumFractionDigits = 2,
): string {
  const decimal = createDecimal(amount);

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(decimal.toNumber());
}
