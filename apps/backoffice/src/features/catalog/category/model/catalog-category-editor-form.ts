import type { Category } from '../../api/catalog-api';
import { normalizeOptionalCatalogCode } from '../../item-editor/model/catalog-item-editor-mapper';

export type CatalogCategoryStatus = Category['status'];

export interface CatalogCategoryEditorForm {
  code: string;
  name: string;
  status: CatalogCategoryStatus;
}

export type CatalogCategoryEditorIssue =
  'NAME_REQUIRED' | 'NAME_TOO_LONG' | 'CODE_REQUIRED' | 'CODE_INVALID';

export interface CatalogCategoryEditorValidation {
  valid: boolean;
  name: CatalogCategoryEditorIssue | null;
  code: CatalogCategoryEditorIssue | null;
}

/** Mirrors the Runtime category contract so obvious mistakes are caught before submit. */
export const CATALOG_CATEGORY_NAME_MAX_LENGTH = 160;
const CATALOG_CATEGORY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

export function createCatalogCategoryEditorForm(
  category: Category | null | undefined,
): CatalogCategoryEditorForm {
  return {
    code: category?.code ?? '',
    name: category?.name ?? '',
    status: category?.status ?? 'ACTIVE',
  };
}

/**
 * A blank code is only allowed on create, where Runtime generates one. Whether a code is taken
 * or uses the tenant's generated pattern is decided by Runtime on save.
 */
export function validateCatalogCategoryEditorForm(
  form: CatalogCategoryEditorForm,
  { fresh }: { fresh: boolean },
): CatalogCategoryEditorValidation {
  const name = form.name.trim();
  const nameIssue: CatalogCategoryEditorIssue | null = !name
    ? 'NAME_REQUIRED'
    : name.length > CATALOG_CATEGORY_NAME_MAX_LENGTH
      ? 'NAME_TOO_LONG'
      : null;

  const code = normalizeOptionalCatalogCode(form.code);
  const codeIssue: CatalogCategoryEditorIssue | null = !code
    ? fresh
      ? null
      : 'CODE_REQUIRED'
    : CATALOG_CATEGORY_CODE_PATTERN.test(code)
      ? null
      : 'CODE_INVALID';

  return { valid: !nameIssue && !codeIssue, name: nameIssue, code: codeIssue };
}

/** Empty code is omitted so Runtime allocates the next generated category code. */
export function toCreateCatalogCategoryInput(form: CatalogCategoryEditorForm) {
  const code = normalizeOptionalCatalogCode(form.code);
  return {
    ...(code ? { code } : {}),
    name: form.name.trim(),
    status: form.status,
  };
}

/** Category identity is its id, so the code is sent as a correctable field. */
export function toUpdateCatalogCategoryInput(form: CatalogCategoryEditorForm) {
  return {
    code: normalizeOptionalCatalogCode(form.code) ?? '',
    name: form.name.trim(),
    status: form.status,
  };
}
