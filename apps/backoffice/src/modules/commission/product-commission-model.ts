import type { ProductCommissionRule } from './product-commission-api';

// A positive exact decimal with at most four fraction digits: "5000", "0.5", "0.0001".
const POSITIVE_DECIMAL = /^(?:[1-9]\d*(?:\.\d{1,4})?|0\.(?=\d{1,4}$)\d*[1-9]\d*)$/;

/** Returns a user-facing message, or null when the amount is a valid positive commission. */
export function validateCommissionAmount(value: string): string | null {
  const text = value.trim();
  if (!text) return 'Nominal komisi wajib diisi.';
  if (!POSITIVE_DECIMAL.test(text)) return 'Isi nominal lebih dari 0, maksimal 4 angka desimal.';
  return null;
}

/** Stored amounts arrive as NUMERIC text ("5000.0000"); show and edit them without trailing zeros. */
export function trimCommissionAmount(value: string | null | undefined): string {
  if (!value) return '';
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/** "Rp5.000 / item" style label. Exact text is formatted, never converted to a JS money number. */
export function commissionPerItemLabel(amount: string, currency: string): string {
  const [whole = '0', fraction = ''] = trimCommissionAmount(amount).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const symbol = currency === 'IDR' ? 'Rp' : `${currency} `;
  return `${symbol}${grouped}${fraction ? `,${fraction}` : ''} / item`;
}

/** Catalog Products that can still be configured: never a Service, never a duplicate row. */
export function selectableProducts<T extends { id: string; type: string }>(
  items: readonly T[],
  rules: readonly Pick<ProductCommissionRule, 'catalogItemId'>[],
): T[] {
  const configured = new Set(rules.map((rule) => rule.catalogItemId));
  return items.filter((item) => item.type === 'PRODUCT' && !configured.has(item.id));
}
