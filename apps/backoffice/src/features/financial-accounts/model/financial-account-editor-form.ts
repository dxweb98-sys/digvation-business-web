import type {
  CreateFinancialAccountInput,
  FinancialAccount,
  FinancialAccountType,
  UpdateFinancialAccountInput,
} from '../api/financial-accounts-api';
import { requiresDestinationDetails } from './financial-account-model';

export interface FinancialAccountEditorForm {
  code: string;
  name: string;
  type: FinancialAccountType;
  currency: string;
  institutionName: string;
  accountReference: string;
  accountHolderName: string;
}

export type FinancialAccountEditorIssue =
  | 'NAME_REQUIRED'
  | 'NAME_TOO_LONG'
  | 'CODE_INVALID'
  | 'CURRENCY_INVALID'
  | 'INSTITUTION_REQUIRED'
  | 'REFERENCE_REQUIRED';

export interface FinancialAccountEditorValidation {
  valid: boolean;
  name: FinancialAccountEditorIssue | null;
  code: FinancialAccountEditorIssue | null;
  currency: FinancialAccountEditorIssue | null;
  institutionName: FinancialAccountEditorIssue | null;
  accountReference: FinancialAccountEditorIssue | null;
}

/** Mirrors the Runtime Financial Account contract so obvious mistakes are caught before submit. */
export const FINANCIAL_ACCOUNT_NAME_MAX_LENGTH = 160;
const FINANCIAL_ACCOUNT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function createFinancialAccountEditorForm(
  account: FinancialAccount | null | undefined,
): FinancialAccountEditorForm {
  return {
    code: account?.code ?? '',
    name: account?.name ?? '',
    type: account?.type ?? 'CASH',
    currency: account?.currency ?? 'IDR',
    institutionName: account?.institutionName ?? '',
    accountReference: account?.accountReference ?? '',
    accountHolderName: account?.accountHolderName ?? '',
  };
}

export function normalizeOptionalAccountCode(code: string) {
  return code.trim().toUpperCase() || null;
}

/**
 * Code, type, and currency are fixed after creation, so they are only validated on create.
 * Whether a code is taken or reserved for generated codes is decided by Runtime on save.
 */
export function validateFinancialAccountEditorForm(
  form: FinancialAccountEditorForm,
  { fresh }: { fresh: boolean },
): FinancialAccountEditorValidation {
  const name = form.name.trim();
  const nameIssue: FinancialAccountEditorIssue | null = !name
    ? 'NAME_REQUIRED'
    : name.length > FINANCIAL_ACCOUNT_NAME_MAX_LENGTH
      ? 'NAME_TOO_LONG'
      : null;
  const code = normalizeOptionalAccountCode(form.code);
  const codeIssue: FinancialAccountEditorIssue | null =
    fresh && code && !FINANCIAL_ACCOUNT_CODE_PATTERN.test(code) ? 'CODE_INVALID' : null;
  const currencyIssue: FinancialAccountEditorIssue | null =
    fresh && !CURRENCY_PATTERN.test(form.currency.trim().toUpperCase()) ? 'CURRENCY_INVALID' : null;
  const needsDetails = requiresDestinationDetails(form.type);
  const institutionIssue: FinancialAccountEditorIssue | null =
    needsDetails && !form.institutionName.trim() ? 'INSTITUTION_REQUIRED' : null;
  const referenceIssue: FinancialAccountEditorIssue | null =
    needsDetails && !form.accountReference.trim() ? 'REFERENCE_REQUIRED' : null;

  return {
    valid: !nameIssue && !codeIssue && !currencyIssue && !institutionIssue && !referenceIssue,
    name: nameIssue,
    code: codeIssue,
    currency: currencyIssue,
    institutionName: institutionIssue,
    accountReference: referenceIssue,
  };
}

/** Cash accounts carry no institution details; other types send the trimmed generic fields. */
function destinationDetails(form: FinancialAccountEditorForm) {
  if (!requiresDestinationDetails(form.type))
    return { institutionName: null, accountReference: null, accountHolderName: null };
  return {
    institutionName: form.institutionName.trim(),
    accountReference: form.accountReference.trim(),
    accountHolderName: form.accountHolderName.trim() || null,
  };
}

/** An empty code is omitted so Runtime allocates the next generated account code. */
export function toCreateFinancialAccountInput(
  form: FinancialAccountEditorForm,
): CreateFinancialAccountInput {
  const code = normalizeOptionalAccountCode(form.code);
  return {
    ...(code ? { code } : {}),
    name: form.name.trim(),
    type: form.type,
    currency: form.currency.trim().toUpperCase(),
    ...destinationDetails(form),
  };
}

/** Code, type, and currency are immutable; only the descriptive fields are sent on update. */
export function toUpdateFinancialAccountInput(
  form: FinancialAccountEditorForm,
): UpdateFinancialAccountInput {
  return { name: form.name.trim(), ...destinationDetails(form) };
}
