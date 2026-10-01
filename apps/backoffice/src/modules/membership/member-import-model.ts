import type { MemberImportRow } from './members-api';

/**
 * Client-side conveniences for Member import. They only spare an obviously wrong upload; every
 * import rule (limits, normalization, duplicates, Customer resolution) is decided by Runtime.
 */
export const MEMBER_IMPORT_TEMPLATE_FILE_NAME = 'template-import-member.xlsx';
export const MEMBER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
/** Preview rows rendered at once; the full result stays in the Runtime response. */
export const MEMBER_IMPORT_PREVIEW_LIMIT = 200;

export type MemberImportFileProblem = 'type' | 'size' | 'empty';

export function memberImportFileProblem(file: {
  name: string;
  size: number;
}): MemberImportFileProblem | null {
  if (!/\.xlsx$/i.test(file.name)) return 'type';
  if (file.size === 0) return 'empty';
  if (file.size > MEMBER_IMPORT_MAX_BYTES) return 'size';
  return null;
}

/** Rows needing attention first (errors, then warnings), each group in workbook order. */
export function memberImportPreviewRows(
  rows: readonly MemberImportRow[],
  limit = MEMBER_IMPORT_PREVIEW_LIMIT,
): MemberImportRow[] {
  const rank = (row: MemberImportRow) => (row.errors.length ? 0 : row.warnings.length ? 1 : 2);
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.rowNumber - b.rowNumber).slice(0, limit);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Displays a NUMERIC points string (e.g. "18750.0000") with locale grouping and without trailing
 * zeros, by string manipulation only: points are never converted to a JavaScript number. A value
 * that is not a plain decimal (an invalid typed cell) is shown as typed.
 */
export function formatImportPoints(value: string, locale: 'id' | 'en'): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, whole = '0', fraction = ''] = match;
  const grouped = whole
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'id' ? '.' : ',');
  const decimals = fraction.replace(/0+$/, '');
  return `${sign}${grouped}${decimals ? `${locale === 'id' ? ',' : '.'}${decimals}` : ''}`;
}

/** True for a positive opening balance ("0.0000" and blank open none). */
export function hasImportOpeningPoints(value: string | null): boolean {
  return value !== null && /^\d+(\.\d+)?$/.test(value) && /[1-9]/.test(value);
}
