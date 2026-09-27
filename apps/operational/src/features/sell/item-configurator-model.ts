import { createDecimal } from '@digvation/pos-money';

import type { CartDraftAdditionalItem } from './cart-draft';
import type {
  CatalogItem,
  CatalogVariant,
  ComponentCandidate,
  FixedComponent,
} from './cashier-transaction.types';

/** Picker-local choice for "the item itself"; it is sent as no variant. */
export const ITEM_OPTION = 'item-option';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

export function isValidQuantity(value: string): boolean {
  if (!QUANTITY_PATTERN.test(value)) return false;
  return createDecimal(value).greaterThan(0);
}

/** Steps a quantity by one, never below one; used by the [-] / [+] controls. */
export function stepQuantity(value: string, delta: 1 | -1): string {
  const current = isValidQuantity(value) ? createDecimal(value) : createDecimal('1');
  const next = current.plus(delta);
  return next.lessThan(1) ? '1' : next.toFixed(next.isInteger() ? 0 : 4).replace(/\.?0+$/, '');
}

export interface AdditionalRow {
  key: string;
  candidateId: string | null;
  variantId: string | null;
  quantity: string;
}

export function newAdditionalRow(): AdditionalRow {
  return {
    key: `additional-${Math.random().toString(36).slice(2)}`,
    candidateId: null,
    variantId: null,
    quantity: '1',
  };
}

/** Runtime already sends the effective fixed BOM per selection: the variant's own, else the default. */
export function fixedComponentsFor(
  item: Pick<CatalogItem, 'fixedComponents'>,
  variant: Pick<CatalogVariant, 'fixedComponents'> | null,
): FixedComponent[] {
  return (variant ? variant.fixedComponents : item.fixedComponents) ?? [];
}

/**
 * Products the operator may still pick for this row. Convenience only: Runtime rejects Products
 * already in the fixed BOM or chosen twice. The row's own choice stays visible.
 */
export function candidatesForRow(
  candidates: readonly ComponentCandidate[],
  fixed: readonly FixedComponent[],
  rows: readonly AdditionalRow[],
  rowKey: string,
  baseItemId?: string,
): ComponentCandidate[] {
  const blocked = new Set<string>(fixed.map((component) => component.componentItemId));
  // The item being sold can never be its own addition.
  if (baseItemId) blocked.add(baseItemId);
  for (const row of rows) if (row.key !== rowKey && row.candidateId) blocked.add(row.candidateId);
  return candidates.filter((candidate) => !blocked.has(candidate.id));
}

export function variantRequirement(
  candidate: ComponentCandidate,
): 'NONE' | 'OPTIONAL' | 'REQUIRED' {
  if (!candidate.variants.length) return 'NONE';
  return candidate.variantSelectionMode === 'REQUIRED' ? 'REQUIRED' : 'OPTIONAL';
}

/** Product/Variant price Runtime offered for this row's selection; billed at Sale time. */
export function additionalUnitPrice(
  row: AdditionalRow,
  candidate: ComponentCandidate | undefined,
): string | null {
  if (!candidate) return null;
  if (row.variantId)
    return (
      candidate.variants.find((variant) => variant.id === row.variantId)?.resolvedPrice?.amount ??
      null
    );
  return candidate.resolvedPrice?.amount ?? null;
}

export type AdditionalRowIssue =
  'PRODUCT_REQUIRED' | 'VARIANT_REQUIRED' | 'QUANTITY_INVALID' | 'PRICE_UNAVAILABLE';

export function additionalRowIssue(
  row: AdditionalRow,
  candidate: ComponentCandidate | undefined,
): AdditionalRowIssue | null {
  if (!candidate) return 'PRODUCT_REQUIRED';
  if (variantRequirement(candidate) === 'REQUIRED' && !row.variantId) return 'VARIANT_REQUIRED';
  if (!isValidQuantity(row.quantity)) return 'QUANTITY_INVALID';
  if (additionalUnitPrice(row, candidate) === null) return 'PRICE_UNAVAILABLE';
  return null;
}

export interface ConfiguratorReadiness {
  ready: boolean;
  /** At least one valid additional item is still needed. */
  additionalMissing: boolean;
}

/** The single rule for enabling "Add to cart". */
export function configuratorReadiness(input: {
  needsVariantChoice: boolean;
  selectedVariantChoice: string | null;
  selectionPrice: string | null;
  quantity: string;
  additionalRequired: boolean;
  rows: readonly AdditionalRow[];
  candidates: readonly ComponentCandidate[];
  /** Required additions with no eligible candidate at all: the item cannot be sold from here. */
  noEligibleCandidates?: boolean;
}): ConfiguratorReadiness {
  const validRows = input.rows.filter(
    (row) =>
      additionalRowIssue(
        row,
        input.candidates.find((candidate) => candidate.id === row.candidateId),
      ) === null,
  );
  const additionalMissing = input.additionalRequired && validRows.length === 0;
  // Rows the operator started but left incomplete must be finished or removed. A row with no
  // Product chosen yet is only a placeholder when additions are optional.
  const startedRows = input.additionalRequired
    ? input.rows
    : input.rows.filter((row) => row.candidateId !== null);
  const incompleteRow = startedRows.length > validRows.length;
  return {
    additionalMissing,
    ready:
      !(input.additionalRequired && input.noEligibleCandidates) &&
      (!input.needsVariantChoice || input.selectedVariantChoice !== null) &&
      input.selectionPrice !== null &&
      isValidQuantity(input.quantity) &&
      !additionalMissing &&
      !incompleteRow,
  };
}

export function additionalItemsOf(
  rows: readonly AdditionalRow[],
  candidates: readonly ComponentCandidate[],
): CartDraftAdditionalItem[] {
  return rows.flatMap((row) => {
    const candidate = candidates.find((entry) => entry.id === row.candidateId);
    const unitPrice = additionalUnitPrice(row, candidate);
    if (!candidate || unitPrice === null || additionalRowIssue(row, candidate)) return [];
    const variant = candidate.variants.find((entry) => entry.id === row.variantId);
    return [
      {
        componentItemId: candidate.id,
        ...(row.variantId ? { componentVariantId: row.variantId } : {}),
        quantity: createDecimal(row.quantity).toFixed(4),
        label: variant ? `${candidate.name} / ${variant.name}` : candidate.name,
        unitPrice,
      },
    ];
  });
}

/** Display estimate; Runtime resolves the authoritative price when the line is captured. */
export function priceSummary(input: {
  servicePrice: string;
  additional: readonly CartDraftAdditionalItem[];
  quantity: string;
}) {
  const additionalUnit = input.additional.reduce(
    (sum, entry) => sum.plus(createDecimal(entry.unitPrice).times(entry.quantity)),
    createDecimal('0'),
  );
  const unit = createDecimal(input.servicePrice).plus(additionalUnit);
  return {
    additionalUnit: additionalUnit.toFixed(4),
    unit: unit.toFixed(4),
    total: isValidQuantity(input.quantity)
      ? unit.times(input.quantity).toFixed(4)
      : unit.toFixed(4),
  };
}

/**
 * Every sellable item is configured in the same dialog before it reaches the cart. Adjusting an
 * existing transaction keeps its inline variant choice unless the Service needs additional items.
 */
export function opensItemConfigurator(
  context: 'CART' | 'TRANSACTION_ADJUSTMENT',
  item: Pick<CatalogItem, 'requireAdditionalItemAtSale'>,
): boolean {
  return context === 'CART' || item.requireAdditionalItemAtSale === true;
}

/** Rows that reopen an already chosen list of additions (editing a cart line). */
export function rowsFromAdditions(additions: readonly CartDraftAdditionalItem[]): AdditionalRow[] {
  return additions.map((entry) => ({
    key: `additional-${entry.componentItemId}:${entry.componentVariantId ?? ''}`,
    candidateId: entry.componentItemId,
    variantId: entry.componentVariantId ?? null,
    quantity: entry.quantity.includes('.') ? entry.quantity.replace(/\.?0+$/, '') : entry.quantity,
  }));
}

/**
 * Stand-ins for the Products of a reopened line, built from what the operator saw when choosing
 * them, so the rows are valid immediately. Real candidates from Runtime replace them as soon as
 * they are searched; the price shown is the one the operator confirmed, never a guess.
 */
export function candidateStubsFromAdditions(
  additions: readonly CartDraftAdditionalItem[],
): ComponentCandidate[] {
  return additions.map((entry) => {
    const separator = entry.label.lastIndexOf(' / ');
    const name =
      entry.componentVariantId && separator > 0 ? entry.label.slice(0, separator) : entry.label;
    const variantName =
      entry.componentVariantId && separator > 0 ? entry.label.slice(separator + 3) : '';
    const price = { amount: entry.unitPrice } as ComponentCandidate['resolvedPrice'];
    return {
      id: entry.componentItemId,
      code: '',
      name,
      productUsage: 'STANDALONE_AND_COMPONENT',
      variantSelectionMode: 'OPTIONAL',
      resolvedPrice: entry.componentVariantId ? null : price,
      variants: entry.componentVariantId
        ? [
            {
              id: entry.componentVariantId,
              code: '',
              name: variantName,
              catalogItemId: entry.componentItemId,
              resolvedPrice: price,
            } as ComponentCandidate['variants'][number],
          ]
        : [],
    };
  });
}

/** Per-unit configuration only applies to whole quantities up to this many units. */
export const MAX_CONFIGURATION_UNITS = 20;

/** One quantity unit's own additions: the switch state and the draft rows behind it. */
export interface UnitConfig {
  key: string;
  enabled: boolean;
  rows: AdditionalRow[];
}

/** A required item starts every unit with additions ON; an optional item starts them OFF. */
export function newUnitConfig(required: boolean, rows?: AdditionalRow[]): UnitConfig {
  return {
    key: `unit-${Math.random().toString(36).slice(2)}`,
    enabled: required || Boolean(rows?.length),
    rows: rows?.length ? rows : required ? [newAdditionalRow()] : [],
  };
}

/**
 * How many independently configurable units a quantity has: each whole unit up to the cap. A
 * fractional or very large quantity is one configuration for the whole amount.
 */
export function unitCountOf(quantity: string): number {
  if (!isValidQuantity(quantity)) return 1;
  const value = createDecimal(quantity);
  if (!value.isInteger() || value.greaterThan(MAX_CONFIGURATION_UNITS)) return 1;
  return value.toNumber();
}

/** Growing adds fresh, empty units (never a silent copy); shrinking keeps the leading units. */
export function resizeUnits(
  units: readonly UnitConfig[],
  count: number,
  required: boolean,
): UnitConfig[] {
  if (units.length === count) return [...units];
  if (units.length > count) return units.slice(0, count);
  return [...units, ...Array.from({ length: count - units.length }, () => newUnitConfig(required))];
}

/** Display estimate over exact per-unit configurations: the sum of each unit, never an average. */
export function priceSummaryUnits(input: {
  basePrice: string;
  unitAdditions: readonly (readonly CartDraftAdditionalItem[])[];
  quantity: string;
}) {
  const perUnit = input.unitAdditions.map((additions) =>
    createDecimal(input.basePrice).plus(
      additions.reduce(
        (sum, entry) => sum.plus(createDecimal(entry.unitPrice).times(entry.quantity)),
        createDecimal('0'),
      ),
    ),
  );
  const total =
    input.unitAdditions.length > 1
      ? perUnit.reduce((sum, amount) => sum.plus(amount), createDecimal('0'))
      : (perUnit[0] ?? createDecimal(input.basePrice)).times(
          isValidQuantity(input.quantity) ? input.quantity : '1',
        );
  return { unitAmounts: perUnit.map((amount) => amount.toFixed(4)), total: total.toFixed(4) };
}
