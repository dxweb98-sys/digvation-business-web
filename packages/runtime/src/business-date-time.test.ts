import { describe, expect, it } from 'vitest';
import { createBusinessDateTimeFormatter } from './business-date-time';
import type { EffectiveBusinessConfiguration } from './runtime-config.types';

function runtime(timezone: string) {
  const businessConfiguration: EffectiveBusinessConfiguration = {
    profile: {
      name: 'DGV Salon',
      configured: true,
      version: 1,
      createdAt: null,
      updatedAt: null,
    },
    preferences: {
      defaultLocale: 'id-ID',
      timezone,
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      version: 1,
      createdAt: null,
      updatedAt: null,
    },
  };
  return { locale: 'id-ID', businessConfiguration };
}

describe('createBusinessDateTimeFormatter', () => {
  const instant = '2026-09-15T01:30:00.000Z';

  it('formats a UTC instant in the configured Jakarta business timezone', () => {
    const formatter = createBusinessDateTimeFormatter(runtime('Asia/Jakarta'));
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 08:30');
  });

  it('changes presentation when business timezone changes without changing the instant', () => {
    const formatter = createBusinessDateTimeFormatter(runtime('Asia/Makassar'));
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 09:30');
    expect(instant).toBe('2026-09-15T01:30:00.000Z');
  });

  it('keeps date-only values as calendar dates without timezone conversion', () => {
    const formatter = createBusinessDateTimeFormatter(runtime('Australia/Sydney'));
    expect(formatter.formatDateOnly('2026-09-15')).toBe('15/09/2026');
    expect(formatter.formatDate('2026-09-15')).toBe('15/09/2026');
  });

  it('uses UTC rather than browser timezone when preferences are unavailable', () => {
    const formatter = createBusinessDateTimeFormatter({ locale: 'id-ID' });
    expect(formatter.timezone).toBe('UTC');
    expect(formatter.formatDateTime(instant)).toBe('15/09/2026 01:30');
  });
});
