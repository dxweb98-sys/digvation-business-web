import { createDecimal } from '@digvation/pos-money';

import type { StartSaleInput } from './cashier-transaction.adapter';
import type {
  CatalogItem,
  CatalogVariant,
  DiscountType,
  ResolvedPrice,
  SaleAdjustment,
  SaleCustomer,
  SaleCustomerSelection,
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
  /**
   * Who the cashier is serving. While the cart is still a local draft there is
   * no Sale to own the identity yet, so it is held here and sent with the very
   * request that creates the Sale — never stored in the browser as authority.
   */
  customer: SaleCustomerSelection | null;
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
  lineDiscountAmount: string;
  discountType: DiscountType | null;
  discountValue: string | null;
  promotion?: {
    name: string;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
  } | null;
}

export function isPositiveCartQuantity(value: string): boolean {
  if (!QUANTITY_PATTERN.test(value)) return false;
  return createDecimal(value).greaterThan(0);
}

export function emptyCartDraft(sellingLocationId: string, currency: string): CartDraft {
  // A new cart starts with no customer. Nothing is inherited from the previous
  // transaction, the previous cashier or the previous session.
  return { sellingLocationId, currency, customer: null, lines: [] };
}

export function setCartDraftCustomer(
  draft: CartDraft,
  customer: SaleCustomerSelection | null,
): CartDraft {
  return { ...draft, customer };
}

/**
 * Presentation of the customer chosen for a cart that has no Sale yet. The
 * values are exactly what the cashier typed; Runtime normalizes them when the
 * Sale is created and the Sale's own snapshot takes over from that moment.
 */
export function draftCustomerSnapshot(
  selection: SaleCustomerSelection | null,
): SaleCustomer | null {
  if (!selection) return null;
  if (selection.type === 'MEMBER')
    return { type: 'MEMBER', referenceId: selection.referenceId, name: '', phoneE164: '' };
  return {
    type: 'NON_MEMBER',
    referenceId: null,
    name: selection.name,
    phoneE164: selection.phone,
  };
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
    lineDiscountAmount: '0.0000',
    discountType: null,
    discountValue: null,
  }));
}

export function saleDisplayLines(
  lines: readonly SaleLine[],
  adjustments: readonly SaleAdjustment[] = [],
): CartDisplayLine[] {
  return lines.map((line) => {
    const lineAdjustments = adjustments.filter((adjustment) => adjustment.saleLineId === line.id);
    const promotion = lineAdjustments.find((adjustment) => adjustment.source === 'PROMOTION');
    const promotionLabel = promotion ? `Promo: ${promotion.label}` : null;
    const singleLineAdjustment = lineAdjustments.length === 1 ? lineAdjustments[0] : null;
    const hasSeveralLineAdjustments = lineAdjustments.length > 1;

    return {
      id: line.id,
      itemNameSnapshot: line.itemNameSnapshot,
      itemTypeSnapshot: line.itemTypeSnapshot,
      variantNameSnapshot:
        [line.variantNameSnapshot, promotionLabel].filter(Boolean).join(' · ') || null,
      quantity: line.quantity,
      effectiveUnitPrice: line.effectiveUnitPrice,
      totalAmount: line.grossAmount,
      lineDiscountAmount: line.lineDiscountAmount,
      discountType: hasSeveralLineAdjustments
        ? null
        : (singleLineAdjustment?.type ?? line.discountType),
      discountValue: hasSeveralLineAdjustments
        ? null
        : (singleLineAdjustment?.configuredValue ?? line.discountValue),
      promotion: promotion
        ? {
            name: promotion.label,
            effectiveFrom: promotion.promotionEffectiveFrom ?? null,
            effectiveUntil: promotion.promotionEffectiveUntil ?? null,
          }
        : null,
    };
  });
}

export function cartDraftEstimatedTotal(draft: CartDraft | null): string {
  return cartDraftDisplayLines(draft)
    .reduce((sum, line) => sum.plus(line.totalAmount), createDecimal('0'))
    .toFixed(4);
}

export function cartDraftStartInput(draft: CartDraft): StartSaleInput {
  if (draft.lines.length === 0) throw new Error('Add at least one item before checkout.');
  if (draft.lines.length > 100) throw new Error('A CartDraft cannot contain more than 100 lines.');
  // The Sale is created with its Customer in one request, so a captured Sale
  // never exists without the identity it belongs to.
  if (!draft.customer) throw new Error('Choose the customer before checkout.');
  return {
    sellingLocationId: draft.sellingLocationId,
    currency: draft.currency,
    customer: draft.customer,
    lines: draft.lines.map((line) => ({
      catalogItemId: line.catalogItemId,
      ...(line.catalogVariantId ? { catalogVariantId: line.catalogVariantId } : {}),
      quantity: line.quantity,
    })),
  };
}
