import { formatDecimalDisplay } from '../../../shared/format/decimal-display';
import type { ReportValue } from '../api/reporting-api';
import { ENUM_LABELS, type EnumName, type ValueKind } from './report-catalog';

export const EMPTY_VALUE = '—';

export interface ReportFormatContext {
  copy: (value: string) => string;
  /** BCP-47 tag for numbers, e.g. `id-ID`. */
  numberLocale: string;
  formatMoney: (amount: string, currency: string) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  currency: string;
}

export const isBlank = (value: ReportValue | undefined) =>
  value === null || value === undefined || value === '';

/** `0.110000` → `11`: an exact fraction as a percentage, without floating point. */
export function fractionToPercent(value: string): string | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const [, sign = '', whole = '0', fraction = ''] = match;
  // Move the decimal point two places right on the digit string itself.
  const digits = (whole + fraction).padEnd(whole.length + 2, '0');
  const point = whole.length + 2;
  const integer = digits.slice(0, point).replace(/^0+(?=\d)/, '');
  const decimals = digits.slice(point);
  return `${sign}${integer}${decimals ? `.${decimals}` : ''}`;
}

export function enumLabel(
  name: EnumName,
  code: ReportValue | undefined,
  copy: (value: string) => string,
) {
  if (isBlank(code)) return EMPTY_VALUE;
  const labels = ENUM_LABELS[name] as Record<string, string>;
  const label = labels[String(code)];
  // An unmapped future code is humanized rather than shown as a raw enum.
  return label
    ? copy(label)
    : String(code)
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/^./, (letter) => letter.toUpperCase());
}

/** Presents one report value by its declared kind; absence reads as `—`. */
export function formatReportValue(
  kind: ValueKind,
  value: ReportValue | undefined,
  context: ReportFormatContext,
  enumName?: EnumName,
): string {
  if (isBlank(value)) return EMPTY_VALUE;
  const text = String(value);
  switch (kind) {
    case 'money':
      return context.formatMoney(text, context.currency);
    case 'signedMoney':
      return text.trim().startsWith('-')
        ? `−${context.formatMoney(text.trim().slice(1), context.currency)}`
        : context.formatMoney(text, context.currency);
    case 'count':
    case 'quantity':
      return formatDecimalDisplay(text, context.numberLocale);
    case 'percent': {
      const percent = fractionToPercent(text);
      return percent === null ? text : `${formatDecimalDisplay(percent, context.numberLocale)}%`;
    }
    case 'date':
      return context.formatDate(
        new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text),
        {
          dateStyle: 'medium',
        },
      );
    case 'datetime':
      return context.formatDate(new Date(text), { dateStyle: 'medium', timeStyle: 'short' });
    case 'time':
      return context.formatDate(new Date(text), { timeStyle: 'short' });
    case 'enum':
    case 'badge':
      return enumName ? enumLabel(enumName, value, context.copy) : text;
    default:
      return text;
  }
}

/**
 * The readable actor of an audited row. The Runtime resolves names; when a name is missing,
 * `<key>Presence` says why, so an account id is never shown.
 */
export function formatActor(
  row: Record<string, ReportValue | undefined>,
  key: string,
  copy: (value: string) => string,
): string {
  const name = row[key];
  if (!isBlank(name)) return String(name);
  const presence = row[`${key}Presence`];
  if (presence === 'SYSTEM') return copy('System');
  if (presence === 'UNAVAILABLE') return copy('Account unavailable');
  return EMPTY_VALUE;
}
