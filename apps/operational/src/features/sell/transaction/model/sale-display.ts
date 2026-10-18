import { createDecimal, formatMoney } from '@digvation/pos-money';
import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../../app/localization/operational-localization';
import { formatServiceDuration } from './sale-presentation';
import type { Sale } from './cashier-transaction.types';
import { amountFractionDigits } from '../../lib/pos-controls';

export function copyFor(value: string, locale: string): string {
  return operationalCopy(value, resolveOperationalLocale(locale));
}

export function money(amount: string, locale: string) {
  // Whole IDR stays clean; a genuinely fractional authoritative amount keeps its fraction.
  return formatMoney(amount, 'IDR', locale, Math.min(4, amountFractionDigits(amount)));
}

export function formatDurationMinutes(
  minutes: number | null | undefined,
  locale: string,
): string | null {
  return formatServiceDuration(minutes, {
    hour: copyFor('hour-short', locale),
    minute: copyFor('minute-short', locale),
  });
}

export function quantity(value: string) {
  const normalized = value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return normalized === '-0' ? '0' : normalized;
}

export function transactionNumber(sale: Pick<Sale, 'id' | 'saleNumber'>, locale: string) {
  // Prefer the authoritative sale number; fall back to the short id for sales without one.
  if (sale.saleNumber) return sale.saleNumber;
  return sale.id.startsWith('SALE-DEMO-')
    ? sale.id
    : `${copyFor('Transaction', locale)} ${sale.id.slice(0, 8)}`;
}

export function isPositiveDecimal(value: string) {
  try {
    return createDecimal(value).greaterThan(createDecimal('0'));
  } catch {
    return false;
  }
}
