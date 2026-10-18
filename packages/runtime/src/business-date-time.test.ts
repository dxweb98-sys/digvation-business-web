import { describe, expect, it } from 'vitest';
import { createBusinessDateTimeFormatter } from './business-date-time';

function preferences(timezone: string) {
  return {
    locale: 'id-ID',
    timezone,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  } as const;
}

describe('createBusinessDateTimeFormatter', () => {
  const instant = '2026-09-15T01:30:00.000Z';

  it('formats a UTC instant in the authenticated Jakarta business timezone', () => {
    const formatter = createBusinessDateTimeFormatter(preferences('Asia/Jakarta'));
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 08:30');
  });

  it('changes presentation when business timezone changes without changing the instant', () => {
    const formatter = createBusinessDateTimeFormatter(preferences('Asia/Makassar'));
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 09:30');
    expect(instant).toBe('2026-09-15T01:30:00.000Z');
  });

  it('keeps date-only values as calendar dates without timezone conversion', () => {
    const formatter = createBusinessDateTimeFormatter(preferences('Australia/Sydney'));
    expect(formatter.formatDateOnly('2026-09-15')).toBe('15/09/2026');
    expect(formatter.formatDate('2026-09-15')).toBe('15/09/2026');
    expect(formatter.formatDateTime('2026-09-15')).toBe('15/09/2026');
    expect(formatter.formatTime('2026-09-15')).toBe('—');
  });

  it('uses UTC rather than browser timezone before authenticated preferences exist', () => {
    const formatter = createBusinessDateTimeFormatter({ locale: 'id-ID' });
    expect(formatter.timezone).toBe('UTC');
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 01:30');
  });
});
