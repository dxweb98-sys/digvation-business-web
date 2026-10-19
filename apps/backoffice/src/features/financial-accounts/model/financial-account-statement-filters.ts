import type {
  FinancialAccountMovementSource,
  FinancialAccountStatementQuery,
} from '../api/financial-accounts-api';

export type StatementDirection = 'IN' | 'OUT';

/** UI filter state: calendar days as `YYYY-MM-DD`; an empty value means the filter is not sent. */
export interface StatementFilterState {
  dateFrom: string;
  dateTo: string;
  source: '' | FinancialAccountMovementSource;
  direction: '' | StatementDirection;
}

export const EMPTY_STATEMENT_FILTERS: StatementFilterState = {
  dateFrom: '',
  dateTo: '',
  source: '',
  direction: '',
};

export const MOVEMENT_SOURCE_LABELS: Record<FinancialAccountMovementSource, string> = {
  PAYMENT: 'Payment received',
  REFUND: 'Refund',
  EXPENSE: 'Expense',
  CASH_MOVEMENT: 'Cash movement',
  PAYMENT_CORRECTION: 'Payment correction',
};

export const STATEMENT_DIRECTION_LABELS: Record<StatementDirection, string> = {
  IN: 'Money in',
  OUT: 'Money out',
};

export function hasStatementFilters(filters: StatementFilterState) {
  return Boolean(filters.dateFrom || filters.dateTo || filters.source || filters.direction);
}

/**
 * Maps the selected calendar days to Runtime's inclusive `occurredAt` window. Days are read in
 * the business time zone — the zone the movement table displays — from the first instant of
 * the start day to the last millisecond before the day after the end day.
 */
export function toStatementFilterQuery(
  filters: StatementFilterState,
  timeZone: string,
): Omit<FinancialAccountStatementQuery, 'limit' | 'offset'> {
  return {
    ...(filters.dateFrom
      ? { from: businessDayStart(filters.dateFrom, timeZone).toISOString() }
      : {}),
    ...(filters.dateTo
      ? {
          to: new Date(
            businessDayStart(nextDay(filters.dateTo), timeZone).getTime() - 1,
          ).toISOString(),
        }
      : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
  };
}

/** The UTC instant at which `day` (`YYYY-MM-DD`) begins in `timeZone`. */
export function businessDayStart(day: string, timeZone: string) {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const wallClock = Date.UTC(year, month - 1, date);
  let instant = wallClock - zoneOffset(wallClock, timeZone);
  // A second pass settles days whose offset changes overnight (daylight saving).
  instant = wallClock - zoneOffset(instant, timeZone);
  return new Date(instant);
}

function nextDay(day: string) {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
function zoneOffset(instant: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  const zoned = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zoned - Math.floor(instant / 1000) * 1000;
}
