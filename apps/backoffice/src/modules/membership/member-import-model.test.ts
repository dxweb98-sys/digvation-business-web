import { describe, expect, it } from 'vitest';

import type { MemberImportRow } from './members-api';
import {
  MEMBER_IMPORT_MAX_BYTES,
  formatImportPoints,
  hasImportOpeningPoints,
  memberImportFileProblem,
  memberImportPreviewRows,
} from './member-import-model';

const row = (rowNumber: number, kind: 'ok' | 'warning' | 'error'): MemberImportRow => ({
  rowNumber,
  name: 'Ayu',
  phone: '+6281234567890',
  memberNumber: null,
  status: 'ACTIVE',
  joinedDate: null,
  openingPoints: '0.0000',
  action: kind === 'error' ? null : 'CREATE_CUSTOMER_AND_MEMBERSHIP',
  errors: kind === 'error' ? [{ field: 'phone', code: 'PHONE_INVALID', message: 'x' }] : [],
  warnings:
    kind === 'warning'
      ? [{ field: 'phone', code: 'EXISTING_CUSTOMER_ENROLLED', message: 'x' }]
      : [],
});

describe('memberImportFileProblem', () => {
  it.each([
    [{ name: 'members.xlsx', size: 10 }, null],
    [{ name: 'MEMBERS.XLSX', size: 10 }, null],
    [{ name: 'members.xls', size: 10 }, 'type'],
    [{ name: 'members.csv', size: 10 }, 'type'],
    [{ name: 'members.xlsx', size: 0 }, 'empty'],
    [{ name: 'members.xlsx', size: MEMBER_IMPORT_MAX_BYTES + 1 }, 'size'],
  ])('%j → %s', (file, problem) => {
    expect(memberImportFileProblem(file)).toBe(problem);
  });
});

describe('memberImportPreviewRows', () => {
  it('lists errors, then warnings, then valid rows, each in workbook order, bounded', () => {
    const rows = [row(2, 'ok'), row(3, 'warning'), row(4, 'error'), row(5, 'error'), row(6, 'ok')];
    expect(memberImportPreviewRows(rows).map((r) => r.rowNumber)).toEqual([4, 5, 3, 2, 6]);
    expect(memberImportPreviewRows(rows, 2).map((r) => r.rowNumber)).toEqual([4, 5]);
  });
});

describe('formatImportPoints', () => {
  it.each([
    ['0.0000', 'id', '0'],
    ['1250.0000', 'id', '1.250'],
    ['1250.5000', 'id', '1.250,5'],
    ['18750.0000', 'en', '18,750'],
    ['999999999999999.9999', 'id', '999.999.999.999.999,9999'],
    ['-10', 'id', '-10'],
    ['abc', 'id', 'abc'],
  ] as const)('formats %s (%s) as %s', (value, locale, expected) => {
    expect(formatImportPoints(value, locale)).toBe(expected);
  });

  it('only treats a positive decimal as an opening balance', () => {
    expect(hasImportOpeningPoints('1250.0000')).toBe(true);
    expect(hasImportOpeningPoints('0.0001')).toBe(true);
    expect(hasImportOpeningPoints('0.0000')).toBe(false);
    expect(hasImportOpeningPoints(null)).toBe(false);
    expect(hasImportOpeningPoints('-10')).toBe(false);
  });
});
