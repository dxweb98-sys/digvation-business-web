import type {
  BusinessDateFormat,
  BusinessTimeFormat,
} from './runtime-config.types';

export type BusinessDateTimeValue = Date | string | number;

export interface BusinessDateTimePreferences {
  locale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

export interface BusinessDateTimeFormatter {
  readonly timezone: string;
  readonly locale: string;
  format(
    value: BusinessDateTimeValue,
    options?: Intl.DateTimeFormatOptions,
  ): string;
  formatDate(value: BusinessDateTimeValue): string;
  formatTime(value: BusinessDateTimeValue): string;
  formatDateTime(value: BusinessDateTimeValue): string;
  formatDateOnly(value: string): string;
}

type DateParts = { year: string; month: string; day: string };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function createBusinessDateTimeFormatter(
  preferences?: Partial<BusinessDateTimePreferences>,
): BusinessDateTimeFormatter {
  // UTC is only an unauthenticated fallback. Authenticated application code
  // passes persisted Runtime business preferences from AuthSession.
  const timezone = preferences?.timezone ?? 'UTC';
  const locale = preferences?.locale ?? 'id-ID';
  const dateFormat: BusinessDateFormat = isBusinessDateFormat(preferences?.dateFormat)
    ? preferences.dateFormat
    : locale === 'en-US'
      ? 'MM/DD/YYYY'
      : 'DD/MM/YYYY';
  const timeFormat: BusinessTimeFormat = isBusinessTimeFormat(preferences?.timeFormat)
    ? preferences.timeFormat
    : 'HH:mm';

  const isDateOnly = (value: BusinessDateTimeValue): value is string =>
    typeof value === 'string' && DATE_ONLY.test(value);

  const instant = (value: BusinessDateTimeValue): Date | null => {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  };

  const zonedDateParts = (value: Date): DateParts => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
        .formatToParts(value)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as DateParts;
    return parts;
  };

  const renderDateParts = ({ year, month, day }: DateParts): string => {
    switch (dateFormat) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}`;
    }
  };

  const formatDateOnly = (value: string): string => {
    const match = DATE_ONLY.exec(value);
    if (!match) return value;
    return renderDateParts({ year: match[1]!, month: match[2]!, day: match[3]! });
  };

  const formatDate = (value: BusinessDateTimeValue): string => {
    if (isDateOnly(value)) return formatDateOnly(value);
    const parsed = instant(value);
    return parsed ? renderDateParts(zonedDateParts(parsed)) : '—';
  };

  const formatTime = (value: BusinessDateTimeValue): string => {
    if (isDateOnly(value)) return '—';
    const parsed = instant(value);
    if (!parsed) return '—';
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        ...(timeFormat === 'hh:mm a'
          ? { hour12: true }
          : { hourCycle: 'h23' as const }),
      })
        .formatToParts(parsed)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    ) as Record<string, string>;
    const base = `${parts.hour ?? '00'}:${parts.minute ?? '00'}`;
    return timeFormat === 'hh:mm a' && parts.dayPeriod
      ? `${base} ${parts.dayPeriod}`
      : base;
  };

  const formatDateTime = (value: BusinessDateTimeValue): string =>
    isDateOnly(value)
      ? formatDateOnly(value)
      : `${formatDate(value)} ${formatTime(value)}`;

  const format = (
    value: BusinessDateTimeValue,
    options?: Intl.DateTimeFormatOptions,
  ): string => {
    if (isDateOnly(value)) return formatDateOnly(value);
    if (!options) return formatDate(value);
    if (options.dateStyle && options.timeStyle) return formatDateTime(value);
    if (options.timeStyle && !options.dateStyle) return formatTime(value);
    if (options.dateStyle && !options.timeStyle) return formatDate(value);
    const parsed = instant(value);
    return parsed
      ? new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(
          parsed,
        )
      : '—';
  };

  return {
    timezone,
    locale,
    format,
    formatDate,
    formatTime,
    formatDateTime,
    formatDateOnly,
  };
}

function isBusinessDateFormat(value: string | undefined): value is BusinessDateFormat {
  return value === 'DD/MM/YYYY' || value === 'MM/DD/YYYY' || value === 'YYYY-MM-DD';
}

function isBusinessTimeFormat(value: string | undefined): value is BusinessTimeFormat {
  return value === 'HH:mm' || value === 'hh:mm a';
}
