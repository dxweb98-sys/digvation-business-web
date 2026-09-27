import type {
  ComponentPricingMode,
  ProductUsage,
  ReplaceServiceCompositionInput,
  ServiceComponentEntry,
  ServiceComposition,
  ServiceCompositionComponent,
} from '../../api/catalog-api';

import { editableAmount, isValidSellingPrice } from './variant-price-draft';

/**
 * Editor state for a Service's component composition (BOM). Runtime is the authority for
 * composition, pricing and validation; this only shapes what the user is editing.
 */
export type ComponentPriceSource = 'FOLLOW_PRODUCT_PRICE' | 'FIXED_COMPONENT_PRICE';

export interface CompositionComponentDraft {
  key: string;
  productId: string | null;
  /** Readable identity of the chosen Product, for display only. */
  productLabel: string;
  productUsage: ProductUsage | null;
  productVariantId: string | null;
  quantity: string;
  /** Off means INCLUDED_IN_SERVICE_PRICE. */
  addsPrice: boolean;
  priceSource: ComponentPriceSource;
  fixedPrice: string;
}

export interface VariantCompositionDraft {
  /** True when this Service variant owns a full BOM instead of using the default. */
  custom: boolean;
  components: CompositionComponentDraft[];
}

export interface ServiceCompositionDraft {
  default: CompositionComponentDraft[];
  /** Keyed by the Service variant draft key (the variant id once persisted). */
  variants: Record<string, VariantCompositionDraft>;
  touched: boolean;
}

export type ProductVariantRequirement = 'NONE' | 'OPTIONAL' | 'REQUIRED';

export type ComponentDraftIssue =
  | 'PRODUCT_REQUIRED'
  | 'VARIANT_REQUIRED'
  | 'QUANTITY_INVALID'
  | 'FIXED_PRICE_INVALID'
  | 'DUPLICATE';

export function emptyServiceCompositionDraft(): ServiceCompositionDraft {
  return { default: [], variants: {}, touched: false };
}

export function newComponentDraft(): CompositionComponentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: null,
    productLabel: '',
    productUsage: null,
    productVariantId: null,
    quantity: '1',
    addsPrice: false,
    priceSource: 'FOLLOW_PRODUCT_PRICE',
    fixedPrice: '',
  };
}

function componentDraftFromApi(component: ServiceCompositionComponent): CompositionComponentDraft {
  const addsPrice = component.pricingMode !== 'INCLUDED_IN_SERVICE_PRICE';
  return {
    key: component.id,
    productId: component.componentItemId,
    productLabel: component.componentName,
    productUsage: component.componentUsage,
    productVariantId: component.componentVariantId,
    quantity: editableAmount(component.quantity),
    addsPrice,
    priceSource:
      component.pricingMode === 'FIXED_COMPONENT_PRICE'
        ? 'FIXED_COMPONENT_PRICE'
        : 'FOLLOW_PRODUCT_PRICE',
    fixedPrice: component.fixedUnitPrice ? editableAmount(component.fixedUnitPrice) : '',
  };
}

export function compositionDraftFromApi(composition: ServiceComposition): ServiceCompositionDraft {
  return {
    default: composition.default.map(componentDraftFromApi),
    variants: Object.fromEntries(
      composition.variantOverrides.map((override) => [
        override.catalogVariantId,
        { custom: true, components: override.components.map(componentDraftFromApi) },
      ]),
    ),
    touched: false,
  };
}

export function pricingModeOf(draft: CompositionComponentDraft): ComponentPricingMode {
  return draft.addsPrice ? draft.priceSource : 'INCLUDED_IN_SERVICE_PRICE';
}

const QUANTITY = /^\d+(?:\.\d{1,4})?$/;

export function isValidComponentQuantity(value: string) {
  const trimmed = value.trim();
  return QUANTITY.test(trimmed) && /[1-9]/.test(trimmed);
}

/** Product + variant identity used to detect an identical component within one BOM. */
function identity(draft: CompositionComponentDraft) {
  return `${draft.productId ?? ''}|${draft.productVariantId ?? ''}`;
}

export function duplicateComponentKeys(components: readonly CompositionComponentDraft[]) {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const component of components) {
    if (!component.productId) continue;
    const id = identity(component);
    if (seen.has(id)) {
      duplicates.add(component.key);
      duplicates.add(seen.get(id)!);
    } else seen.set(id, component.key);
  }
  return duplicates;
}

/**
 * Included pricing needs only Product, required variant and quantity. Followed prices are
 * resolved by Runtime, so the editor never asks for an amount. Fixed prices need a valid amount.
 */
export function componentDraftIssue(
  draft: CompositionComponentDraft,
  variantRequirement: ProductVariantRequirement,
  duplicateKeys: ReadonlySet<string> = new Set(),
): ComponentDraftIssue | null {
  if (!draft.productId) return 'PRODUCT_REQUIRED';
  if (variantRequirement === 'REQUIRED' && !draft.productVariantId) return 'VARIANT_REQUIRED';
  if (!isValidComponentQuantity(draft.quantity)) return 'QUANTITY_INVALID';
  if (
    draft.addsPrice &&
    draft.priceSource === 'FIXED_COMPONENT_PRICE' &&
    !isValidFixedComponentPrice(draft.fixedPrice)
  )
    return 'FIXED_PRICE_INVALID';
  if (duplicateKeys.has(draft.key)) return 'DUPLICATE';
  return null;
}

/** A fixed BOM price may be zero, unlike an ordinary selling price. */
export function isValidFixedComponentPrice(value: string) {
  return isValidSellingPrice(value) || /^0(?:\.0{1,4})?$/.test(value.trim());
}

export function bomHasIssues(
  components: readonly CompositionComponentDraft[],
  requirementOf: (productId: string) => ProductVariantRequirement,
) {
  const duplicates = duplicateComponentKeys(components);
  return components.some(
    (component) =>
      componentDraftIssue(
        component,
        component.productId ? requirementOf(component.productId) : 'NONE',
        duplicates,
      ) !== null,
  );
}

/** Only the BOMs Runtime will actually use are validated: default plus custom variant BOMs. */
export function compositionHasIssues(
  draft: ServiceCompositionDraft,
  variantKeys: readonly string[],
  requirementOf: (productId: string) => ProductVariantRequirement,
) {
  if (bomHasIssues(draft.default, requirementOf)) return true;
  return variantKeys.some((key) => {
    const variant = draft.variants[key];
    return variant?.custom === true && bomHasIssues(variant.components, requirementOf);
  });
}

function entryOf(draft: CompositionComponentDraft): ServiceComponentEntry {
  const pricingMode = pricingModeOf(draft);
  return {
    componentItemId: draft.productId!,
    componentVariantId: draft.productVariantId,
    quantity: draft.quantity.trim(),
    pricingMode,
    fixedUnitPrice: pricingMode === 'FIXED_COMPONENT_PRICE' ? draft.fixedPrice.trim() : null,
  };
}

/**
 * Runtime command for the composition. A variant that does not use custom components is sent
 * with an empty list, which reverts it to the default composition.
 */
export function compositionSubmission(
  draft: ServiceCompositionDraft,
  variants: ReadonlyArray<{ key: string; variantId: string | null }>,
  expectedVersion: number,
): ReplaceServiceCompositionInput {
  return {
    expectedVersion,
    default: draft.default.filter((c) => c.productId).map(entryOf),
    variantOverrides: variants.flatMap(({ key, variantId }) => {
      if (!variantId) return [];
      const variant = draft.variants[key];
      return [
        {
          catalogVariantId: variantId,
          components:
            variant?.custom === true
              ? variant.components.filter((c) => c.productId).map(entryOf)
              : [],
        },
      ];
    }),
  };
}

export function updateDefaultComponents(
  draft: ServiceCompositionDraft,
  components: CompositionComponentDraft[],
): ServiceCompositionDraft {
  return { ...draft, default: components, touched: true };
}

/** Switching to custom starts from the current default so the user edits a full BOM, not a diff. */
export function setVariantCustom(
  draft: ServiceCompositionDraft,
  variantKey: string,
  custom: boolean,
): ServiceCompositionDraft {
  const existing = draft.variants[variantKey];
  return {
    ...draft,
    touched: true,
    variants: {
      ...draft.variants,
      [variantKey]: custom
        ? {
            custom: true,
            components: existing?.components.length
              ? existing.components
              : draft.default.map((component) => ({
                  ...component,
                  key: `${variantKey}-${component.key}`,
                })),
          }
        : { custom: false, components: existing?.components ?? [] },
    },
  };
}

export function updateVariantComponents(
  draft: ServiceCompositionDraft,
  variantKey: string,
  components: CompositionComponentDraft[],
): ServiceCompositionDraft {
  return {
    ...draft,
    touched: true,
    variants: { ...draft.variants, [variantKey]: { custom: true, components } },
  };
}

const SCALE = 10_000n;

function toUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(trimmed)) return null;
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return BigInt(whole + fraction.padEnd(4, '0'));
}

function fromUnits(units: bigint) {
  const whole = units / SCALE;
  const fraction = (units % SCALE).toString().padStart(4, '0');
  return `${whole}.${fraction}`;
}

/** quantity x unit amount at 4 decimals, half-up; display estimate only, Runtime is authoritative. */
export function componentContribution(quantity: string, unitAmount: string): string | null {
  const q = toUnits(quantity);
  const p = toUnits(unitAmount);
  if (q === null || p === null) return null;
  const product = q * p;
  return fromUnits((product + SCALE / 2n) / SCALE);
}
