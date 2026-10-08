import type {
  CatalogItem,
  CatalogVariant,
} from '../../transaction/model/cashier-transaction.types';

export type VariantPickerContext = 'CART' | 'TRANSACTION_ADJUSTMENT';

/** Inline variant choice used while adjusting an existing transaction. */
export interface VariantPickerState {
  item: CatalogItem;
  variants: readonly CatalogVariant[];
  /**
   * Present only when the item itself is also sold without a variant; `price` is its own price,
   * or null when no current price is available. Absent for items that require a variant.
   */
  itemOption?: { price: string | null } | null;
  pricesByVariantId?: Readonly<Record<string, string>>;
  unavailableVariantIds?: readonly string[];
  locale?: string;
  currency?: string;
  context?: VariantPickerContext;
  targetSaleId?: string;
}
