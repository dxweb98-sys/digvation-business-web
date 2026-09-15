import { createDecimal } from '@digvation/pos-money';

import type { StartSaleInput } from './cashier-transaction.adapter';
import type {
  CatalogItem,
  CatalogVariant,
  ResolvedPrice,
  SaleLine,
} from './cashier-transaction.types';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

export interface CartDraftLine {
  id: string;
  catalogItemId: string;
  catalogVariantId?: string;
  catalogPriceId: string;
  itemName: string;
  itemType: CatalogItem['type'];
  variantName: string | null;
  quantity: string;
  resolvedUnitPrice: string;
}

export interface CartDraft {
  sellingLocationId: string;
  currency: string;
  lines: readonly CartDraftLine[];
}

export interface CartDisplayLine {
  id: string;
  itemNameSnapshot: string;
  itemTypeSnapshot: CatalogItem['type'];
  variantNameSnapshot: string | null;
  quantity: string;
  effectiveUnitPrice: string;
  totalAmount: string;
}

export function isPositiveCartQuantity(value: string): boolean {
  if (!QUANTITY_PATTERN.test(value)) return false;
  return createDecimal(value).greaterThan(0);
}

export function emptyCartDraft(sellingLocationId: string, currency: string): CartDraft {
  return { sellingLocationId, currency, lines: [] };
}

export function addCartDraftSelection(
  draft: CartDraft,
  item: CatalogItem,
  variant: CatalogVariant | null,
  price: ResolvedPrice,
): CartDraft {
  const existing = draft.lines.find(
    (line) =>
      line.catalogItemId === item.id &&
      line.catalogVariantId === (variant?.id ?? undefined) &&
      line.catalogPriceId === price.catalogPriceId &&
      line.resolvedUnitPrice === price.amount,
  );
  if (existing) {
    return setCartDraftQuantity(
      draft,
      existing.id,
      createDecimal(existing.quantity).plus(1).toFixed(4),
    );
  }

  const id = `draft:${item.id}:${variant?.id ?? 'base'}:${price.catalogPriceId}`;
  return {
    ...draft,
    lines: [
      ...draft.lines,
      {
        id,
        catalogItemId: item.id,
        ...(variant ? { catalogVariantId: variant.id } : {}),
        catalogPriceId: price.catalogPriceId,
        itemName: item.name,
        itemType: item.type,
        variantName: variant?.name ?? null,
        quantity: '1.0000',
        resolvedUnitPrice: price.amount,
      },
    ],
  };
}

export function setCartDraftQuantity(
  draft: CartDraft,
  lineId: string,
  quantity: string,
): CartDraft {
  if (!isPositiveCartQuantity(quantity)) {
    throw new Error('Quantity must be greater than zero with at most four decimal places.');
  }
  return {
    ...draft,
    lines: draft.lines.map((line) =>
      line.id === lineId ? { ...line, quantity: createDecimal(quantity).toFixed(4) } : line,
    ),
  };
}

export function removeCartDraftLine(draft: CartDraft, lineId: string): CartDraft {
  return { ...draft, lines: draft.lines.filter((line) => line.id !== lineId) };
}

export function cartDraftDisplayLines(draft: CartDraft | null): CartDisplayLine[] {
  return (draft?.lines ?? []).map((line) => ({
    id: line.id,
    itemNameSnapshot: line.itemName,
    itemTypeSnapshot: line.itemType,
    variantNameSnapshot: line.variantName,
    quantity: line.quantity,
    effectiveUnitPrice: line.resolvedUnitPrice,
    totalAmount: createDecimal(line.resolvedUnitPrice).times(line.quantity).toFixed(4),
  }));
}

export function saleDisplayLines(lines: readonly SaleLine[]): CartDisplayLine[] {
  return lines.map((line) => ({
    id: line.id,
    itemNameSnapshot: line.itemNameSnapshot,
    itemTypeSnapshot: line.itemTypeSnapshot,
    variantNameSnapshot: line.variantNameSnapshot,
    quantity: line.quantity,
    effectiveUnitPrice: line.effectiveUnitPrice,
    totalAmount: line.totalAmount,
  }));
}

export function cartDraftEstimatedTotal(draft: CartDraft | null): string {
  return cartDraftDisplayLines(draft)
    .reduce((sum, line) => sum.plus(line.totalAmount), createDecimal('0'))
    .toFixed(4);
}

export function cartDraftStartInput(draft: CartDraft): StartSaleInput {
  if (draft.lines.length === 0) throw new Error('Add at least one item before checkout.');
  if (draft.lines.length > 100) throw new Error('A CartDraft cannot contain more than 100 lines.');
  return {
    sellingLocationId: draft.sellingLocationId,
    currency: draft.currency,
    lines: draft.lines.map((line) => ({
      catalogItemId: line.catalogItemId,
      ...(line.catalogVariantId ? { catalogVariantId: line.catalogVariantId } : {}),
      quantity: line.quantity,
    })),
  };
}
