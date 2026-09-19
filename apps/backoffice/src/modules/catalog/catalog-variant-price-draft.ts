/**
 * Draft variant prices edited inside the Add/Edit item dialog before Runtime persists them.
 * Every variant carries its own final price; there is no inherited item price.
 */
export interface VariantPriceDraft {
  key: string;
  /** Persisted variant id; null for a variant that is created on save. */
  id: string | null;
  code: string;
  name: string;
  price: string;
  /** Explicit price Runtime currently holds for this variant; null when it has none. */
  persistedPrice: string | null;
  /** Runtime could not report the current price (e.g. a draft item is not resolvable yet). */
  priceUnknown?: boolean;
}

const AMOUNT = /^\d+(?:\.\d{1,4})?$/;

function amountUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!AMOUNT.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole + fraction.padEnd(4, '0'));
}

/** Selling prices entered in Backoffice must be positive, as in the existing item price field. */
export function isValidSellingPrice(value: string) {
  const units = amountUnits(value);
  return units !== null && units > 0n;
}

export function compareAmounts(left: string, right: string) {
  const a = amountUnits(left) ?? 0n;
  const b = amountUnits(right) ?? 0n;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sameAmount(left: string, right: string) {
  const a = amountUnits(left);
  return a !== null && a === amountUnits(right);
}

/** Runtime amounts are four-place strings; inputs show them without trailing zero fractions. */
export function editableAmount(value: string) {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

export function newVariantDraft(): VariantPriceDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    id: null,
    code: '',
    name: '',
    price: '',
    persistedPrice: null,
  };
}

/** Local "Apply price to all variants": every draft gets the same explicit price, still editable. */
export function applyPriceToAllVariants(
  drafts: readonly VariantPriceDraft[],
  amount: string,
): VariantPriceDraft[] {
  const price = amount.trim();
  return drafts.map((draft) => ({ ...draft, price }));
}

export type VariantDraftIssue = 'NAME_REQUIRED' | 'PRICE_REQUIRED' | 'PRICE_INVALID';

/** A new variant needs a name and, when pricing is managed here, an explicit valid price. */
export function variantDraftIssue(
  draft: VariantPriceDraft,
  requirePrice: boolean,
): VariantDraftIssue | null {
  if (!draft.id && !draft.name.trim()) return 'NAME_REQUIRED';
  if (!draft.price.trim()) {
    // Existing variants without a price may stay unchanged; new variants may not.
    return requirePrice && (!draft.id || draft.persistedPrice !== null) ? 'PRICE_REQUIRED' : null;
  }
  return isValidSellingPrice(draft.price) ? null : 'PRICE_INVALID';
}

/**
 * Explicit variant prices to hand to Runtime, grouped by amount so each group is one atomic
 * `change-variants` request. Unchanged persisted prices are left out (Runtime would no-op them).
 */
export function variantPriceSubmissions(
  drafts: readonly VariantPriceDraft[],
  variantIdByKey: ReadonlyMap<string, string>,
): Array<{ amount: string; catalogVariantIds: string[] }> {
  const groups = new Map<string, { amount: string; catalogVariantIds: string[] }>();
  for (const draft of drafts) {
    const variantId = draft.id ?? variantIdByKey.get(draft.key);
    const units = amountUnits(draft.price);
    if (!variantId || units === null || units <= 0n) continue;
    if (draft.persistedPrice !== null && sameAmount(draft.persistedPrice, draft.price)) continue;
    const group = groups.get(units.toString()) ?? {
      amount: draft.price.trim(),
      catalogVariantIds: [],
    };
    group.catalogVariantIds.push(variantId);
    groups.set(units.toString(), group);
  }
  return [...groups.values()];
}
