import { describe, expect, it } from 'vitest';

import { reportingCopy } from '../localization/reporting-copy';
import { ENUM_LABELS, isCatalogReport, REPORT_CATALOG, reportDefinition } from './report-catalog';
import {
  enumLabel,
  formatReportValue,
  fractionToPercent,
  type ReportFormatContext,
} from './report-format';

describe('Report catalog', () => {
  it('is exactly the current business reports, in order, without dormant projections', () => {
    expect(REPORT_CATALOG.map((report) => report.type)).toEqual([
      'business-performance',
      'transactions',
      'catalog-performance',
      'component-usage',
      'product-commission',
      'employee-performance',
      'attendance',
      'payments',
      'expenses',
      'cash',
      'tax',
      'locations',
    ]);
    expect(isCatalogReport('settlements')).toBe(false);
    expect(isCatalogReport('reconciliations')).toBe(false);
  });

  it('opens a detail only for records with a meaningful single-record view', () => {
    expect(
      Object.fromEntries(REPORT_CATALOG.map((report) => [report.type, report.detail])),
    ).toEqual({
      'business-performance': null,
      transactions: 'transaction',
      'catalog-performance': null,
      'component-usage': 'component-usage',
      'product-commission': 'product-commission',
      'employee-performance': 'employee',
      attendance: null,
      payments: 'payment',
      expenses: null,
      cash: null,
      tax: 'tax',
      locations: null,
    });
  });

  it('keeps business performance a summary without a record table', () => {
    expect(reportDefinition('business-performance')?.columns).toBeNull();
    for (const report of REPORT_CATALOG.filter((r) => r.type !== 'business-performance'))
      expect(report.columns?.length).toBeGreaterThan(0);
  });

  it('never shows technical identifiers as table columns', () => {
    for (const report of REPORT_CATALOG)
      for (const column of report.columns ?? [])
        expect(column.key, `${report.type}.${column.key}`).not.toMatch(
          /(^id$|Id$|reversesEntryId)/,
        );
  });

  it('localizes every report, KPI, column, filter, analytics title, and enum label in both languages', () => {
    const labels = REPORT_CATALOG.flatMap((report) => [
      report.label,
      ...report.kpis.map((kpi) => kpi.label),
      ...(report.columns ?? []).map((column) => column.label),
      ...report.filters.map((filter) => filter.label),
      ...(report.search ? [report.search.label] : []),
      ...[report.analytics.trend, report.analytics.ranking, ...(report.analytics.breakdowns ?? [])]
        .filter(Boolean)
        .map((chart) => chart!.title),
    ]);
    const enums = Object.values(ENUM_LABELS).flatMap((labels) => Object.values(labels));
    const missing = [...new Set([...labels, ...enums])].filter(
      (label) => !reportingCopy[label]?.id || !reportingCopy[label]?.en,
    );
    expect(missing).toEqual([]);
  });
});

describe('Report value formatting', () => {
  const ctx: ReportFormatContext = {
    copy: (value) => reportingCopy[value]?.id ?? value,
    numberLocale: 'id-ID',
    formatMoney: (value) => `Rp ${Number(value).toLocaleString('id-ID')}`,
    formatDate: (value) => new Date(value).toISOString().slice(0, 10),
    currency: 'IDR',
  };

  it('turns stored rate fractions into readable percentages without float drift', () => {
    expect(fractionToPercent('0.110000')).toBe('11.0000');
    expect(fractionToPercent('0.005')).toBe('0.5');
    expect(fractionToPercent('1')).toBe('100');
    expect(formatReportValue('percent', '0.110000', ctx)).toBe('11%');
    expect(formatReportValue('percent', '0.125', ctx)).toBe('12,5%');
  });

  it('labels codes in business language and humanizes an unknown code instead of leaking it', () => {
    expect(enumLabel('componentSource', 'FIXED_BOM', ctx.copy)).toBe('Komponen terkonfigurasi');
    expect(enumLabel('expenseOrigin', 'CASHIER', ctx.copy)).toBe('Operasional');
    expect(enumLabel('paymentMethod', 'NEW_RAIL', ctx.copy)).toBe('New rail');
  });

  it('trims stored decimals, signs reversals, and shows a quiet dash for missing values', () => {
    expect(formatReportValue('quantity', '1.5000', ctx)).toBe('1,5');
    expect(formatReportValue('count', 12, ctx)).toBe('12');
    expect(formatReportValue('signedMoney', '-10000.0000', ctx)).toBe('−Rp 10.000');
    expect(formatReportValue('money', null, ctx)).toBe('—');
    expect(formatReportValue('text', '', ctx)).toBe('—');
  });
});
