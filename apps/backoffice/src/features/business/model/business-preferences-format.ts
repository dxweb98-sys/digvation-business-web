import type { BusinessPreferences } from '../api/business-settings-api';

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
export const TIME_FORMATS = ['HH:mm', 'hh:mm a'] as const;

/** A fixed sample date so each format reads as a real date, not a pattern. */
export function dateFormatExample(format: BusinessPreferences['dateFormat']) {
  switch (format) {
    case 'MM/DD/YYYY':
      return '10/31/2026';
    case 'YYYY-MM-DD':
      return '2026-10-31';
    case 'DD/MM/YYYY':
    default:
      return '31/10/2026';
  }
}

export function timeFormatExample(format: BusinessPreferences['timeFormat']) {
  return format === 'hh:mm a' ? '02:30 PM' : '14:30';
}

/** "24 jam (14:30)"; `copy` localizes the hour-cycle name. */
export function timeFormatLabel(
  format: BusinessPreferences['timeFormat'],
  copy: (value: string) => string,
) {
  return `${copy(format === 'hh:mm a' ? '12-hour' : '24-hour')} (${timeFormatExample(format)})`;
}

/** The time zone's long name when the browser knows it, e.g. "Waktu Indonesia Barat". */
export function timezoneName(timeZone: string, locale: string) {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'long' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName');
    return part?.value ?? null;
  } catch {
    return null;
  }
}
