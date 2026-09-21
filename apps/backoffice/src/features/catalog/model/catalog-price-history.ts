import type { PriceHistoryEntry, ResolvedPrice, Variant } from '../api/catalog-api';
import { compareAmounts, isValidSellingPrice, sameAmount } from '../item-editor/model/variant-price-draft';

/**
 * Presentation of Runtime pricing facts. Runtime stays the price authority: these helpers only
 * describe resolved prices and history rows, and never decide what a variant sells for.
 */

export type VariantPriceState =
  | { kind: 'loading' }
  | { kind: 'explicit'; amount: string; currency: string }
  | { kind: 'missing' }
  /** Runtime cannot resolve a selling price now, e.g. the item is still a draft. */
  | { kind: 'unavailable' };

export function variantPriceState(
  query:
    | {
        data: ResolvedPrice | undefined;
        isLoading: boolean;
        isError: boolean;
        error?: unknown;
      }
    | undefined,
  variantId: string,
): VariantPriceState {
  if (!query || query.isLoading) return { kind: 'loading' };
  if (query.isError)
    return (query.error as { code?: unknown } | null)?.code === 'PRICE_NOT_FOUND'
      ? { kind: 'missing' }
      : { kind: 'unavailable' };
  if (!query.data) return { kind: 'missing' };
  // Runtime resolves a variant only from its own price; anything else is not an explicit price.
  const { amount, currency, sourceScope } = query.data;
  return sourceScope.catalogVariantId === variantId
    ? { kind: 'explicit', amount, currency }
    : { kind: 'missing' };
}

export interface BulkVariantPricePreviewRow {
  variant: Variant;
  state: VariantPriceState;
  /** Preview only; Runtime reports the authoritative no-op per variant. */
  unchanged: boolean;
}

/** Active variants the bulk action targets, with the change each one is expected to receive. */
export function bulkVariantPricePreview(
  variants: readonly Variant[],
  states: ReadonlyMap<string, VariantPriceState>,
  amount: string,
): BulkVariantPricePreviewRow[] {
  const validTarget = isValidSellingPrice(amount);
  return variants
    .filter((variant) => variant.status === 'ACTIVE')
    .map((variant) => {
      const state = states.get(variant.id) ?? { kind: 'loading' };
      return {
        variant,
        state,
        unchanged: validTarget && state.kind === 'explicit' && sameAmount(state.amount, amount),
      };
    });
}

/** Lowest and highest explicit variant price, for the item price summary. */
export function explicitVariantPriceRange(states: Iterable<VariantPriceState>) {
  const amounts = [...states].flatMap((state) =>
    state.kind === 'explicit' ? [{ amount: state.amount, currency: state.currency }] : [],
  );
  if (!amounts.length) return null;
  const sorted = [...amounts].sort((a, b) => compareAmounts(a.amount, b.amount));
  return { min: sorted[0]!, max: sorted[sorted.length - 1]! };
}

export function priceHistoryTarget(entry: PriceHistoryEntry) {
  return entry.catalogVariantId
    ? {
        scope: 'VARIANT' as const,
        name: entry.catalogVariantName ?? 'Varian',
        sku: entry.catalogVariantCode,
      }
    : { scope: 'ITEM' as const, name: 'Harga item', sku: null };
}

export function priceChangeActorLabel(entry: PriceHistoryEntry) {
  const actor = entry.changedBy;
  if (!actor) return 'Tidak tercatat';
  if (actor.kind !== 'user') return 'Sistem';
  return actor.displayName ?? 'Pengguna tidak dikenal';
}
