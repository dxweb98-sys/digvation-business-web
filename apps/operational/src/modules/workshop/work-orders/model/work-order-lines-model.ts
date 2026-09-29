import type {
  PickerCandidate,
  PickerItem,
  PickerPrice,
  PickerVariant,
  WorkshopItemType,
  WorkshopLineSelectionInput,
} from '../api/workshop-lines-api';
import type { WorkshopWorkOrderStatus } from '../api/workshop-queue-api';

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,14})(\.\d{1,4})?$/;

/**
 * Initial item selection is offered only before work starts, once, and to
 * someone who may update Work Order items. Runtime enforces the same rule.
 */
export function canSelectInitialItems(
  status: WorkshopWorkOrderStatus,
  permissions: readonly string[],
  acceptedLineCount: number,
): boolean {
  return (
    acceptedLineCount === 0 &&
    (status === 'WAITING' || status === 'ASSIGNED') &&
    permissions.includes('work-order-items:update')
  );
}

export function isValidQuantity(value: string): boolean {
  return QUANTITY_PATTERN.test(value) && Number(value) > 0;
}

/** "2.0000" -> "2", "1.5000" -> "1.5". Display only. */
export function formatQuantity(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

export function activeVariants(item: PickerItem): PickerVariant[] {
  return (item.variants ?? []).filter((variant) => variant.status === 'ACTIVE');
}

/** Items the picker may offer: active, and never a component-only Product on its own. */
export function isSelectableItem(item: PickerItem): boolean {
  return item.lifecycle === 'ACTIVE' && item.productUsage !== 'COMPONENT_ONLY';
}

/** With active variants an item is sold by variant, plus by itself only when Catalog says OPTIONAL. */
export function itemHasOwnOption(item: PickerItem): boolean {
  return activeVariants(item).length === 0 || item.variantSelectionMode === 'OPTIONAL';
}

export type ItemPriceHint =
  | { kind: 'exact'; price: PickerPrice }
  | { kind: 'from'; price: PickerPrice }
  | { kind: 'none' };

/** What the row can honestly say about price from the resolved Catalog data. */
export function itemPriceHint(item: PickerItem): ItemPriceHint {
  const variants = activeVariants(item);
  if (variants.length === 0)
    return item.resolvedPrice ? { kind: 'exact', price: item.resolvedPrice } : { kind: 'none' };
  const prices = variants.flatMap((variant) => (variant.resolvedPrice ? [variant.resolvedPrice] : []));
  if (itemHasOwnOption(item) && item.resolvedPrice) prices.push(item.resolvedPrice);
  const lowest = prices.reduce<PickerPrice | null>(
    (best, price) => (best === null || Number(price.amount) < Number(best.amount) ? price : best),
    null,
  );
  if (!lowest) return { kind: 'none' };
  const single = prices.length === 1 && variants.length === 1 && !itemHasOwnOption(item);
  return { kind: single ? 'exact' : 'from', price: lowest };
}

export interface DraftAdditional {
  itemId: string;
  itemName: string;
  variantId: string | null;
}

/** Browser-only draft. Never authoritative; Runtime re-resolves everything on submit. */
export interface DraftLine {
  key: string;
  itemId: string;
  itemName: string;
  itemType: WorkshopItemType;
  variantId: string | null;
  variantName: string | null;
  quantity: string;
  unitPrice: PickerPrice | null;
  includes: string[];
  includedItemIds: string[];
  /** Catalog says the operator must choose an additional item for this one. */
  requiresAdditional: boolean;
  additional: DraftAdditional | null;
}

let sequence = 0;

export function draftLineFor(item: PickerItem, variant: PickerVariant | null): DraftLine {
  sequence += 1;
  const components = variant?.fixedComponents ?? item.fixedComponents ?? [];
  return {
    key: `draft-${sequence}`,
    itemId: item.id,
    itemName: item.name,
    itemType: item.type,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    quantity: '1',
    unitPrice: variant ? variant.resolvedPrice : (item.resolvedPrice ?? null),
    includedItemIds: components.map((component) => component.componentItemId),
    includes: components.map(
      (component) =>
        `${component.variantName ? `${component.itemName} (${component.variantName})` : component.itemName} ×${formatQuantity(component.quantity)}`,
    ),
    requiresAdditional: item.requireAdditionalItemAtSale === true,
    additional: null,
  };
}

const additionalSignature = (line: DraftLine) =>
  line.additional ? `${line.additional.itemId}|${line.additional.variantId ?? ''}` : '';

/**
 * Adding the same resolved selection again (same item, variant and additional
 * item) raises the existing row's quantity instead of duplicating the row.
 */
export function addToDraft(draft: readonly DraftLine[], next: DraftLine): DraftLine[] {
  const same = draft.find(
    (line) =>
      line.itemId === next.itemId &&
      line.variantId === next.variantId &&
      additionalSignature(line) === additionalSignature(next),
  );
  if (!same) return [...draft, next];
  return draft.map((line) =>
    line === same ? { ...line, quantity: addQuantities(line.quantity, next.quantity) } : line,
  );
}

function addQuantities(left: string, right: string): string {
  return String(Math.round((Number(left) + Number(right)) * 10000) / 10000);
}

/** Stepper arithmetic: never leaves the valid range, unchanged when the text is not a quantity. */
export function stepQuantity(value: string, delta: number): string {
  if (!isValidQuantity(value)) return '1';
  const next = Math.round((Number(value) + delta) * 10000) / 10000;
  return next > 0 ? String(next) : value;
}

/** Items that need a choice before they can be added: a Variant, or a required additional item. */
export function isConfigurable(item: PickerItem): boolean {
  return activeVariants(item).length > 0 || item.requireAdditionalItemAtSale === true;
}

export function draftLinesFor(draft: readonly DraftLine[], itemId: string): number {
  return draft.filter((line) => line.itemId === itemId).length;
}

export function draftIssue(line: DraftLine): 'quantity' | 'additional' | null {
  if (!isValidQuantity(line.quantity)) return 'quantity';
  if (line.requiresAdditional && !line.additional) return 'additional';
  return null;
}

export function draftReady(draft: readonly DraftLine[]): boolean {
  return draft.length > 0 && draft.every((line) => draftIssue(line) === null);
}

export function toSelectionInput(draft: readonly DraftLine[]): WorkshopLineSelectionInput[] {
  return draft.map((line) => ({
    catalogItemId: line.itemId,
    ...(line.variantId ? { catalogVariantId: line.variantId } : {}),
    quantity: line.quantity,
    ...(line.additional
      ? {
          additionalComponents: [
            {
              componentItemId: line.additional.itemId,
              ...(line.additional.variantId
                ? { componentVariantId: line.additional.variantId }
                : {}),
              quantity: '1',
            },
          ],
        }
      : {}),
  }));
}

/** Candidates the operator may add to `line`: never the item itself or one it already includes. */
export function candidatesFor(
  candidates: readonly PickerCandidate[],
  line: Pick<DraftLine, 'itemId' | 'includedItemIds'>,
): PickerCandidate[] {
  return candidates.filter(
    (candidate) => candidate.id !== line.itemId && !line.includedItemIds.includes(candidate.id),
  );
}

/** Runtime error codes the item selection can present. Keys are Runtime's exact codes. */
export const WORKSHOP_LINES_ERROR_COPY: Record<string, string> = {
  WORKSHOP_WORK_ORDER_LINES_STATE_INVALID:
    'Items can only be selected before work starts on this Work Order.',
  WORKSHOP_WORK_ORDER_LINES_ALREADY_ACCEPTED:
    'The items of this Work Order were already saved by someone else.',
  CATALOG_ITEM_NOT_FOUND: 'One of the items is no longer available. Reopen the list and choose again.',
  CATALOG_VARIANT_NOT_FOUND: 'One of the variants is no longer available. Reopen the list and choose again.',
  CATALOG_ITEM_COMPONENT_ONLY: 'One of the items cannot be selected on its own.',
  PRICE_NOT_FOUND: 'One of the items has no price right now. Choose another item.',
  DOMAIN_VALIDATION_ERROR: 'Check the items, variants and quantities, then try again.',
  SERVICE_ADDITIONAL_ITEM_REQUIRED: 'Choose the additional item this service needs.',
  SERVICE_ADDITIONAL_ITEM_NOT_FOUND: 'The additional item is no longer available.',
  SERVICE_ADDITIONAL_ITEM_IN_FIXED_BOM: 'This item is already included in the service.',
  SERVICE_ADDITIONAL_ITEM_DUPLICATE: 'Each additional item can be chosen only once.',
  ADDITIONAL_ITEM_IS_BASE_ITEM: 'A service cannot be its own additional item.',
  SERVICE_COMPONENT_PRICE_NOT_FOUND: 'An included part has no price right now. Choose another item.',
  FORBIDDEN: 'You do not have permission to select items for this Work Order.',
};

/** Conflicts whose cause is a changed Work Order: the open version is stale and must be reloaded. */
export const WORKSHOP_LINES_STALE_CODES: readonly string[] = [
  'VERSION_CONFLICT',
  'WORKSHOP_WORK_ORDER_LINES_ALREADY_ACCEPTED',
  'WORKSHOP_WORK_ORDER_LINES_STATE_INVALID',
];
