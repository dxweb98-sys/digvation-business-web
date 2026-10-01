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
