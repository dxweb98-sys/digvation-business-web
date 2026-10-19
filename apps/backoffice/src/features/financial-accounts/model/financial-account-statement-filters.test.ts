import { describe, expect, it } from 'vitest';

import {
  EMPTY_STATEMENT_FILTERS,
  hasStatementFilters,
  toStatementFilterQuery,
} from './financial-account-statement-filters';

const period = (dateFrom: string, dateTo: string, timeZone: string) =>
  toStatementFilterQuery({ ...EMPTY_STATEMENT_FILTERS, dateFrom, dateTo }, timeZone);

describe('toStatementFilterQuery', () => {
  it('sends no filter when none is selected', () => {
    expect(toStatementFilterQuery(EMPTY_STATEMENT_FILTERS, 'Asia/Jakarta')).toEqual({});
    expect(hasStatementFilters(EMPTY_STATEMENT_FILTERS)).toBe(false);
  });

  it('covers whole business-time-zone days, inclusive of both ends', () => {
    // 1 Oct in Jakarta (UTC+7) starts at 17:00 UTC on 30 Sep — not at UTC midnight.
    expect(period('2026-10-01', '2026-10-03', 'Asia/Jakarta')).toEqual({
      from: '2026-09-30T17:00:00.000Z',
      to: '2026-10-03T16:59:59.999Z',
    });
    expect(period('2026-10-01', '2026-10-01', 'Asia/Makassar')).toEqual({
      from: '2026-09-30T16:00:00.000Z',
      to: '2026-10-01T15:59:59.999Z',
    });
    expect(period('2026-10-01', '2026-10-01', 'UTC')).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-01T23:59:59.999Z',
    });
  });

  it('keeps day boundaries exact across a daylight-saving change', () => {
    // New York springs forward on 8 Mar 2026: that day is 23 hours long.
    expect(period('2026-03-08', '2026-03-08', 'America/New_York')).toEqual({
      from: '2026-03-08T05:00:00.000Z',
      to: '2026-03-09T03:59:59.999Z',
    });
  });

  it('sends only the selected side of an open-ended period', () => {
    expect(
      toStatementFilterQuery({ ...EMPTY_STATEMENT_FILTERS, dateTo: '2026-10-31' }, 'Asia/Jakarta'),
    ).toEqual({ to: '2026-10-31T16:59:59.999Z' });
  });

  it('sends exact Runtime source and direction enums and omits cleared filters', () => {
    for (const source of [
      'PAYMENT',
      'REFUND',
      'EXPENSE',
      'CASH_MOVEMENT',
      'PAYMENT_CORRECTION',
    ] as const) {
      expect(toStatementFilterQuery({ ...EMPTY_STATEMENT_FILTERS, source }, 'UTC')).toEqual({
        source,
      });
    }
    expect(toStatementFilterQuery({ ...EMPTY_STATEMENT_FILTERS, direction: 'OUT' }, 'UTC')).toEqual(
      { direction: 'OUT' },
    );
    expect(hasStatementFilters({ ...EMPTY_STATEMENT_FILTERS, direction: 'IN' })).toBe(true);
  });
});
