import type { NumberingNamespace } from '../api/business-settings-api';

/** Copy keys for each numbering namespace. */
export const NAMESPACE_LABELS: Record<NumberingNamespace, string> = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
  CATEGORY: 'Category',
  VARIANT: 'Variant',
  EMPLOYEE: 'Employee',
  EMPLOYEE_POSITION: 'Employee Position',
  SALE: 'Sale / Transaction',
  INVOICE: 'Invoice',
};

const PREFIX_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,15}$/;

export function isValidNumberingPrefix(prefix: string): boolean {
  return PREFIX_PATTERN.test(prefix);
}

export function isValidNumberingPadding(padding: string): boolean {
  const value = Number(padding);
  return padding.trim().length > 0 && Number.isInteger(value) && value >= 1 && value <= 12;
}
