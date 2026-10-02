import { createDecimal } from '@digvation/pos-money';

import type { ReplaceSaleLineInput, StartSaleInput } from './cashier-transaction.adapter';
import { isSaleLineReplaceable, saleLineAdditions, saleLineBase } from './sale-line-additions';
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

/** An additional Product the operator chose for a Service; Runtime validates and prices it. */
export interface CartDraftAdditionalItem {
  componentItemId: string;
  componentVariantId?: string;
  quantity: string;
  /** Display only: readable Product / Variant name. */
  label: string;
  /** Display only: the Product/Variant price Runtime offered when it was chosen. */
  unitPrice: string;
  /**
   * Service only: who performs this additional item ("Dikerjakan oleh"). Part of the Service's
   * work, never a Product salesperson; absent or empty means nobody is assigned to it.
   */
  performers?: CartDraftSalesperson[];
}

/** Order-independent identity of who performs an addition. */
function performerSignature(performers: readonly CartDraftSalesperson[] | undefined): string {
  return (performers ?? [])
    .map((performer) => performer.employeeId)
    .sort()
    .join(',');
}

/**
 * Stable identity of one unit's additions: same Products, Variants, quantities and performers
 * means the same configuration and price. Order does not matter.
 */
export function additionSignature(additions: readonly CartDraftAdditionalItem[]): string {
  return additions
    .map(
      (entry) =>
        `${entry.componentItemId}:${entry.componentVariantId ?? ''}:${createDecimal(entry.quantity).toFixed(4)}:${performerSignature(entry.performers)}`,
    )
    .sort()
    .join('|');
}

export interface UnitAdditionGroup {
  additionalComponents: readonly CartDraftAdditionalItem[];
  /** How many units share exactly this configuration. */
  quantity: number;
}

/** Groups identical unit configurations in first-appearance order; distinct ones stay distinct. */
export function groupUnitAdditions(
  unitAdditions: readonly (readonly CartDraftAdditionalItem[])[],
): UnitAdditionGroup[] {
  const groups = new Map<string, UnitAdditionGroup>();
  for (const additions of unitAdditions) {
    const signature = additionSignature(additions);
    const group = groups.get(signature);
    if (group) group.quantity += 1;
    else groups.set(signature, { additionalComponents: additions, quantity: 1 });
  }
  return [...groups.values()];
}

/**
 * Optional Product salesperson attribution. It is line identity for commission purposes and is
 * distinct from Service performers and contributors. `name` is display only.
 */
export interface CartDraftSalesperson {
  employeeId: string;
  name: string;
}

/** Two attributions are the same only when both are absent or name the same Employee. */
export function sameSalesperson(
  left: Pick<CartDraftSalesperson, 'employeeId'> | null | undefined,
  right: Pick<CartDraftSalesperson, 'employeeId'> | null | undefined,
): boolean {
  return (left?.employeeId ?? null) === (right?.employeeId ?? null);
}

export interface CartDraftLine {
  id: string;
  /** Product only: who sold this line. Absent means no salesperson, never a default Employee. */
  soldBy?: CartDraftSalesperson;
  /**
   * Set only when the units of a whole-number quantity are configured differently. One entry per
   * unit (length = quantity); `additionalComponents` is then unused. Identical units never use this.
   */
  unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
  /** In-memory reference to the sold item, so the operator can reopen the configurator. */
  catalogItem?: CatalogItem;
  additionalComponents?: readonly CartDraftAdditionalItem[];
  /** Display only: sum of additional item price x quantity per Service unit. */
  additionalUnitContribution?: string;
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

export interface CartDisplayAddition {
  label: string;
  /** Quantity used for the whole line. */
  quantity: string;
  /** Selling unit price snapshot of the Product/Variant. */
  unitPrice: string;
  /** Billed amount for the whole line. */
  amount: string;
  /** Service only: who performs this addition, as the operator chose them. */
  performers?: readonly CartDraftSalesperson[];
}

export interface CartDisplayUnit {
  /** 1-based position of the unit within its line. */
  index: number;
  additions: readonly CartDisplayAddition[];
  /** Exact amount of this unit: base price plus its own additions. */
  amount: string;
}

export interface CartDisplayLine {
  id: string;
  itemNameSnapshot: string;
  itemTypeSnapshot: CatalogItem['type'];
  variantNameSnapshot: string | null;
  /** Display only: the Product salesperson, when one is attributed. */
  soldByName?: string | null;
  quantity: string;
  effectiveUnitPrice: string;
  totalAmount: string;
  /**
   * Transaction-selected additions only (never fixed BOM), already part of the line amount.
   * `quantity` is what was used for the whole line and `amount` what it bills, so base +
   * additions = line amount. Absent when the units of a draft line are configured differently.
   */
  additions?: readonly CartDisplayAddition[];
  /** Price of the base item alone, per unit (line amount minus additions). */
  baseUnitPrice?: string;
  /** Present only for a draft line whose units carry different additions: each unit stands alone. */
  units?: readonly CartDisplayUnit[];
  /** True for a local draft line that can be reopened in the configurator. */
  editable?: boolean;
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

/**
 * The Sale lines that one item configuration becomes: units with different additions are separate
 * lines (one line always has one unit price), identical units share a line. Used identically by
 * adding an item and by editing or correcting one, so both mean exactly the same thing.
 */
export function replacementLinesOf(
  catalogItemId: string,
  catalogVariantId: string | null,
  configuration: {
    quantity: string;
    additionalComponents: readonly CartDraftAdditionalItem[];
    unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
    /** Carried explicitly into every recreated line: a replacement never silently drops it. */
    soldByEmployeeId?: string | null;
  },
): ReplaceSaleLineInput['lines'] {
  const groups = configuration.unitAdditions
    ? groupUnitAdditions(configuration.unitAdditions).map((group) => ({
        quantity: String(group.quantity),
        additions: group.additionalComponents,
      }))
    : [{ quantity: configuration.quantity, additions: configuration.additionalComponents }];
  return groups.map((group) => ({
    catalogItemId,
    ...(catalogVariantId ? { catalogVariantId } : {}),
    quantity: group.quantity,
    ...(group.additions.length ? { additionalComponents: group.additions.map(startAddition) } : {}),
    ...(configuration.soldByEmployeeId ? { soldByEmployeeId: configuration.soldByEmployeeId } : {}),
  }));
}

export interface CartDraftSelectionOptions {
  quantity?: string;
  additionalComponents?: readonly CartDraftAdditionalItem[];
  /** One entry per unit, only when the units differ; then `additionalComponents` is not used. */
  unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[];
  /** Product only. Part of the line identity: different salespeople never merge. */
  soldBy?: CartDraftSalesperson | null;
}

function additionalContribution(additional: readonly CartDraftAdditionalItem[]) {
  return additional
    .reduce(
      (sum, entry) => sum.plus(createDecimal(entry.unitPrice).times(entry.quantity)),
      createDecimal('0'),
    )
    .toFixed(4);
}

export function addCartDraftSelection(
  draft: CartDraft,
  item: CatalogItem,
  variant: CatalogVariant | null,
  price: ResolvedPrice,
  options: CartDraftSelectionOptions = {},
): CartDraft {
  const quantity = options.quantity ?? '1';
  if (!isPositiveCartQuantity(quantity)) {
    throw new Error('Quantity must be greater than zero with at most four decimal places.');
  }
  const additional = options.additionalComponents ?? [];
  const unitAdditions = options.unitAdditions;
  // Lines carrying operator-chosen additional items describe a specific composition and never merge.
  const existing =
    additional.length || unitAdditions
      ? undefined
      : draft.lines.find(
          (line) =>
            !line.additionalComponents?.length &&
            !line.unitAdditions &&
            sameSalesperson(line.soldBy, options.soldBy) &&
            line.catalogItemId === item.id &&
            line.catalogVariantId === (variant?.id ?? undefined) &&
            line.catalogPriceId === price.catalogPriceId &&
            line.resolvedUnitPrice === price.amount,
        );
  if (existing) {
    return setCartDraftQuantity(
      draft,
      existing.id,
      createDecimal(existing.quantity).plus(quantity).toFixed(4),
    );
  }

  const id = `draft:${item.id}:${variant?.id ?? 'base'}:${price.catalogPriceId}${
    options.soldBy ? `:seller:${options.soldBy.employeeId}` : ''
  }${additional.length || unitAdditions ? `:${crypto.randomUUID()}` : ''}`;
  return {
    ...draft,
    lines: [
      ...draft.lines,
      buildDraftLine(id, item, variant, price, quantity, additional, unitAdditions, options.soldBy),
    ],
  };
}

function buildDraftLine(
  id: string,
  item: CatalogItem,
  variant: CatalogVariant | null,
  price: ResolvedPrice,
  quantity: string,
  additional: readonly CartDraftAdditionalItem[],
  unitAdditions?: readonly (readonly CartDraftAdditionalItem[])[],
  soldBy?: CartDraftSalesperson | null,
): CartDraftLine {
  if (unitAdditions && unitAdditions.length !== Number(quantity))
    throw new Error('Every unit needs its own configuration.');
  // Only a Product can have a salesperson; a Service line never carries one.
  const seller = item.type === 'PRODUCT' && soldBy ? soldBy : undefined;
  return {
    id,
    catalogItem: item,
    ...(seller ? { soldBy: seller } : {}),
    ...(unitAdditions ? { unitAdditions } : {}),
    ...(additional.length
      ? {
          additionalComponents: additional,
          additionalUnitContribution: additionalContribution(additional),
        }
      : {}),
    catalogItemId: item.id,
    ...(variant ? { catalogVariantId: variant.id } : {}),
    catalogPriceId: price.catalogPriceId,
    itemName: item.name,
    itemType: item.type,
    variantName: variant?.name ?? null,
    quantity: createDecimal(quantity).toFixed(4),
    resolvedUnitPrice: price.amount,
  };
}

/**
 * Edits a local draft line in place (same position, same id): the whole configuration is replaced,
 * never merged with another line. Nothing is persisted until the Sale is started.
 */
export function replaceCartDraftLine(
  draft: CartDraft,
  lineId: string,
  item: CatalogItem,
  variant: CatalogVariant | null,
  price: ResolvedPrice,
  options: CartDraftSelectionOptions = {},
): CartDraft {
  const quantity = options.quantity ?? '1';
  if (!isPositiveCartQuantity(quantity)) {
    throw new Error('Quantity must be greater than zero with at most four decimal places.');
  }
  if (!draft.lines.some((line) => line.id === lineId)) return draft;
  return {
    ...draft,
    lines: draft.lines.map((line) =>
      line.id === lineId
        ? buildDraftLine(
            line.id,
            item,
            variant,
            price,
            quantity,
            options.additionalComponents ?? [],
            options.unitAdditions,
            options.soldBy,
          )
        : line,
    ),
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
    lines: draft.lines.map((line) => {
      if (line.id !== lineId) return line;
      if (!line.unitAdditions) return { ...line, quantity: createDecimal(quantity).toFixed(4) };
      // Units carrying their own additions can shrink (the leading ones stay) but never grow here:
      // a new unit must be configured explicitly, never silently copied from another.
      const next = createDecimal(quantity);
      if (!next.isInteger() || next.greaterThan(line.unitAdditions.length))
        throw new Error('Configure each new unit in the item editor.');
      return {
        ...line,
        quantity: next.toFixed(4),
        unitAdditions: line.unitAdditions.slice(0, next.toNumber()),
      };
    }),
  };
}

export function removeCartDraftLine(draft: CartDraft, lineId: string): CartDraft {
  return { ...draft, lines: draft.lines.filter((line) => line.id !== lineId) };
}

/** Estimate only: Runtime resolves the authoritative price when the Sale is created. */
function draftUnitPrice(line: CartDraftLine): string {
  return createDecimal(line.resolvedUnitPrice)
    .plus(line.additionalUnitContribution ?? '0')
    .toFixed(4);
}

function displayAddition(
  entry: CartDraftAdditionalItem,
  lineQuantity: string,
): CartDisplayAddition {
  const used = createDecimal(entry.quantity).times(lineQuantity);
  return {
    label: entry.label,
    quantity: used.toFixed(4),
    unitPrice: entry.unitPrice,
    amount: used.times(entry.unitPrice).toFixed(4),
    ...(entry.performers?.length ? { performers: entry.performers } : {}),
  };
}

function draftLineBreakdown(line: CartDraftLine) {
  if (line.unitAdditions) {
    return {
      baseUnitPrice: line.resolvedUnitPrice,
      units: line.unitAdditions.map((additions, index) => ({
        index: index + 1,
        additions: additions.map((entry) => displayAddition(entry, '1')),
        amount: createDecimal(line.resolvedUnitPrice)
          .plus(additionalContribution(additions))
          .toFixed(4),
      })),
    };
  }
  if (!line.additionalComponents?.length) return {};
  return {
    baseUnitPrice: line.resolvedUnitPrice,
    additions: line.additionalComponents.map((entry) => displayAddition(entry, line.quantity)),
  };
}

/** Sum of exact unit amounts when the units differ: never an average times the quantity. */
function draftLineTotal(line: CartDraftLine): string {
  if (line.unitAdditions)
    return line.unitAdditions
      .reduce(
        (sum, additions) =>
          sum.plus(line.resolvedUnitPrice).plus(additionalContribution(additions)),
        createDecimal('0'),
      )
      .toFixed(4);
  return createDecimal(draftUnitPrice(line)).times(line.quantity).toFixed(4);
}

export function cartDraftDisplayLines(draft: CartDraft | null): CartDisplayLine[] {
  return (draft?.lines ?? []).map((line) => ({
    id: line.id,
    itemNameSnapshot: line.itemName,
    itemTypeSnapshot: line.itemType,
    variantNameSnapshot: line.variantName,
    soldByName: line.soldBy?.name ?? null,
    quantity: line.quantity,
    ...draftLineBreakdown(line),
    editable: Boolean(line.catalogItem),
    effectiveUnitPrice: line.unitAdditions ? line.resolvedUnitPrice : draftUnitPrice(line),
    totalAmount: draftLineTotal(line),
    lineDiscountAmount: '0.0000',
    discountType: null,
    discountValue: null,
  }));
}

function saleLineBreakdown(line: SaleLine) {
  const additions = saleLineAdditions(line);
  if (!additions.length) return {};
  return {
    baseUnitPrice: saleLineBase(line, additions).unitPrice,
    additions: additions.map((addition) => ({
      label: addition.name,
      quantity: addition.quantity,
      unitPrice: addition.unitPrice,
      amount: addition.amount,
    })),
  };
}

export function saleDisplayLines(
  lines: readonly SaleLine[],
  adjustments: readonly SaleAdjustment[] = [],
  options: { canEdit?: boolean } = {},
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
      soldByName: line.soldByEmployeeNameSnapshot ?? null,
      quantity: line.quantity,
      ...saleLineBreakdown(line),
      // Offered only while the Sale is OPEN and free of a pending payment, and the line is free.
      editable: options.canEdit === true && isSaleLineReplaceable(line),
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
  const sentLines = draft.lines.reduce(
    (count, line) =>
      count + (line.unitAdditions ? groupUnitAdditions(line.unitAdditions).length : 1),
    0,
  );
  if (sentLines > 100) throw new Error('A CartDraft cannot contain more than 100 lines.');
  // The Sale is created with its Customer in one request, so a captured Sale
  // never exists without the identity it belongs to.
  if (!draft.customer) throw new Error('Choose the customer before checkout.');
  return {
    sellingLocationId: draft.sellingLocationId,
    currency: draft.currency,
    customer: draft.customer,
    lines: draft.lines.flatMap((line) => {
      const base = {
        catalogItemId: line.catalogItemId,
        ...(line.catalogVariantId ? { catalogVariantId: line.catalogVariantId } : {}),
        ...(line.soldBy ? { soldByEmployeeId: line.soldBy.employeeId } : {}),
      };
      // One persisted line is one unambiguous unit price. Units with different additions become
      // separate lines (identical ones stay grouped), so no average price is ever invented.
      const groups = line.unitAdditions
        ? groupUnitAdditions(line.unitAdditions).map((group) => ({
            quantity: createDecimal(String(group.quantity)).toFixed(4),
            additions: group.additionalComponents,
          }))
        : [{ quantity: line.quantity, additions: line.additionalComponents ?? [] }];
      return groups.map((group) => ({
        ...base,
        quantity: group.quantity,
        ...(group.additions.length
          ? { additionalComponents: group.additions.map(startAddition) }
          : {}),
      }));
    }),
  };
}

/** The Runtime input for one addition, with its performers when anyone performs it. */
export function startAddition(entry: CartDraftAdditionalItem) {
  return {
    componentItemId: entry.componentItemId,
    ...(entry.componentVariantId ? { componentVariantId: entry.componentVariantId } : {}),
    quantity: entry.quantity,
    ...(entry.performers?.length
      ? { performers: entry.performers.map((performer) => ({ employeeId: performer.employeeId })) }
      : {}),
  };
}
