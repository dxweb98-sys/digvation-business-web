import { describe, expect, it } from 'vitest';

import type { ServiceComposition, ServiceCompositionComponent } from '../../api/catalog-api';
import {
  compositionDraftFromApi,
  compositionHasIssues,
  compositionSubmission,
  componentContribution,
  componentDraftIssue,
  duplicateComponentKeys,
  emptyServiceCompositionDraft,
  newComponentDraft,
  pricingModeOf,
  setVariantCustom,
  updateDefaultComponents,
  updateVariantComponents,
  type CompositionComponentDraft,
} from './service-composition-draft';

const draft = (overrides: Partial<CompositionComponentDraft> = {}): CompositionComponentDraft => ({
  ...newComponentDraft(),
  productId: 'dye',
  productLabel: 'Hair Dye',
  ...overrides,
});

const apiComponent = (
  overrides: Partial<ServiceCompositionComponent> = {},
): ServiceCompositionComponent => ({
  id: 'c1',
  position: 0,
  componentItemId: 'dye',
  componentVariantId: 'dye-red',
  quantity: '1.0000',
  pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
  fixedUnitPrice: null,
  componentCode: 'DYE',
  componentName: 'Hair Dye',
  componentUsage: 'COMPONENT_ONLY',
  componentVariantCode: 'RED',
  componentVariantName: 'Red',
  ...overrides,
});

const optional = () => 'OPTIONAL' as const;

describe('component pricing toggle', () => {
  it('defaults to included in the Service price with no price controls active', () => {
    const component = newComponentDraft();
    expect(component.addsPrice).toBe(false);
    expect(pricingModeOf(component)).toBe('INCLUDED_IN_SERVICE_PRICE');
  });

  it('exposes follow/fixed choices only when the toggle is on', () => {
    expect(pricingModeOf(draft({ addsPrice: true }))).toBe('FOLLOW_PRODUCT_PRICE');
    expect(pricingModeOf(draft({ addsPrice: true, priceSource: 'FIXED_COMPONENT_PRICE' }))).toBe(
      'FIXED_COMPONENT_PRICE',
    );
    expect(pricingModeOf(draft({ addsPrice: false, priceSource: 'FIXED_COMPONENT_PRICE' }))).toBe(
      'INCLUDED_IN_SERVICE_PRICE',
    );
  });
});

describe('componentDraftIssue', () => {
  it('requires a Product', () => {
    expect(componentDraftIssue(draft({ productId: null }), 'NONE')).toBe('PRODUCT_REQUIRED');
  });

  it('requires a Product variant only when Runtime requires selection', () => {
    expect(componentDraftIssue(draft({ productVariantId: null }), 'REQUIRED')).toBe(
      'VARIANT_REQUIRED',
    );
    expect(componentDraftIssue(draft({ productVariantId: 'v1' }), 'REQUIRED')).toBeNull();
    expect(componentDraftIssue(draft({ productVariantId: null }), 'OPTIONAL')).toBeNull();
    expect(componentDraftIssue(draft({ productVariantId: null }), 'NONE')).toBeNull();
  });

  it.each(['', '0', '0.0000', '-1', 'abc', '1.23456', '1e2'])('rejects quantity %p', (quantity) => {
    expect(componentDraftIssue(draft({ quantity }), 'NONE')).toBe('QUANTITY_INVALID');
  });

  it.each(['1', '2', '0.5', '1.2500'])('accepts quantity %p', (quantity) => {
    expect(componentDraftIssue(draft({ quantity }), 'NONE')).toBeNull();
  });

  it('needs no price for an included component', () => {
    expect(componentDraftIssue(draft({ addsPrice: false, fixedPrice: '' }), 'NONE')).toBeNull();
  });

  it('does not ask for an amount when following the Product price', () => {
    expect(
      componentDraftIssue(draft({ addsPrice: true, priceSource: 'FOLLOW_PRODUCT_PRICE' }), 'NONE'),
    ).toBeNull();
  });

  it('requires a valid amount for a fixed component price', () => {
    const fixed = { addsPrice: true, priceSource: 'FIXED_COMPONENT_PRICE' as const };
    expect(componentDraftIssue(draft({ ...fixed, fixedPrice: '' }), 'NONE')).toBe(
      'FIXED_PRICE_INVALID',
    );
    expect(componentDraftIssue(draft({ ...fixed, fixedPrice: 'x' }), 'NONE')).toBe(
      'FIXED_PRICE_INVALID',
    );
    expect(componentDraftIssue(draft({ ...fixed, fixedPrice: '18000' }), 'NONE')).toBeNull();
  });
});

describe('duplicate prevention', () => {
  it('flags identical Product and Variant entries', () => {
    const a = draft({ key: 'a', productVariantId: 'v1' });
    const b = draft({ key: 'b', productVariantId: 'v1' });
    const c = draft({ key: 'c', productVariantId: 'v2' });
    const duplicates = duplicateComponentKeys([a, b, c]);
    expect([...duplicates].sort()).toEqual(['a', 'b']);
    expect(componentDraftIssue(a, 'OPTIONAL', duplicates)).toBe('DUPLICATE');
    expect(componentDraftIssue(c, 'OPTIONAL', duplicates)).toBeNull();
  });

  it('ignores rows without a Product', () => {
    expect(
      duplicateComponentKeys([draft({ key: 'a', productId: null }), draft({ key: 'b', productId: null })])
        .size,
    ).toBe(0);
  });
});

describe('composition drafts', () => {
  const composition: ServiceComposition = {
    catalogItemId: 'svc',
    version: 3,
    default: [apiComponent({ id: 'd1', componentVariantId: null, componentUsage: 'STANDALONE_AND_COMPONENT' })],
    variantOverrides: [
      {
        catalogVariantId: 'svc-red',
        components: [
          apiComponent({
            id: 'o1',
            quantity: '2.5000',
            pricingMode: 'FIXED_COMPONENT_PRICE',
            fixedUnitPrice: '18000.0000',
          }),
        ],
      },
    ],
  };

  it('hydrates default BOM and marks only overridden variants as custom', () => {
    const hydrated = compositionDraftFromApi(composition);
    expect(hydrated.touched).toBe(false);
    expect(hydrated.default).toHaveLength(1);
    expect(hydrated.variants['svc-red']?.custom).toBe(true);
    expect(hydrated.variants['svc-blue']).toBeUndefined();
    expect(hydrated.variants['svc-red']?.components[0]).toMatchObject({
      quantity: '2.5',
      addsPrice: true,
      priceSource: 'FIXED_COMPONENT_PRICE',
      fixedPrice: '18000',
      productVariantId: 'dye-red',
    });
  });

  it('a variant without an override keeps using the default (custom=false)', () => {
    const hydrated = compositionDraftFromApi(composition);
    const submission = compositionSubmission(
      hydrated,
      [
        { key: 'svc-red', variantId: 'svc-red' },
        { key: 'svc-blue', variantId: 'svc-blue' },
      ],
      4,
    );
    expect(submission.expectedVersion).toBe(4);
    expect(submission.variantOverrides).toEqual([
      {
        catalogVariantId: 'svc-red',
        components: [
          {
            componentItemId: 'dye',
            componentVariantId: 'dye-red',
            quantity: '2.5',
            pricingMode: 'FIXED_COMPONENT_PRICE',
            fixedUnitPrice: '18000',
          },
        ],
      },
      // An empty list reverts to the default BOM; it is never merged.
      { catalogVariantId: 'svc-blue', components: [] },
    ]);
  });

  it('reverts a variant to the default composition', () => {
    let state = compositionDraftFromApi(composition);
    state = setVariantCustom(state, 'svc-red', false);
    const submission = compositionSubmission(state, [{ key: 'svc-red', variantId: 'svc-red' }], 1);
    expect(submission.variantOverrides).toEqual([{ catalogVariantId: 'svc-red', components: [] }]);
    expect(state.touched).toBe(true);
  });

  it('starts a custom variant BOM as a full copy of the default, editable independently', () => {
    let state = updateDefaultComponents(emptyServiceCompositionDraft(), [
      draft({ key: 'k1', productVariantId: 'dye-red' }),
    ]);
    state = setVariantCustom(state, 'svc-blue', true);
    expect(state.variants['svc-blue']?.custom).toBe(true);
    expect(state.variants['svc-blue']?.components).toHaveLength(1);
    state = updateVariantComponents(state, 'svc-blue', [draft({ key: 'x', productVariantId: 'dye-blue' })]);
    expect(state.default[0]?.productVariantId).toBe('dye-red');
    expect(state.variants['svc-blue']?.components[0]?.productVariantId).toBe('dye-blue');
  });

  it('skips variants that do not exist yet and unfilled rows in the submission', () => {
    const state = updateDefaultComponents(emptyServiceCompositionDraft(), [
      draft(),
      draft({ productId: null }),
    ]);
    const submission = compositionSubmission(state, [{ key: 'new-variant', variantId: null }], 1);
    expect(submission.default).toHaveLength(1);
    expect(submission.variantOverrides).toEqual([]);
  });

  it('sends explicit Product and Variant ids, never names', () => {
    const state = updateDefaultComponents(emptyServiceCompositionDraft(), [
      draft({ productLabel: 'Red', productVariantId: 'dye-red' }),
    ]);
    const [entry] = compositionSubmission(state, [], 1).default;
    expect(entry).toEqual({
      componentItemId: 'dye',
      componentVariantId: 'dye-red',
      quantity: '1',
      pricingMode: 'INCLUDED_IN_SERVICE_PRICE',
      fixedUnitPrice: null,
    });
  });
});

describe('compositionHasIssues', () => {
  it('validates the default BOM and custom variant BOMs but not unused variant drafts', () => {
    let state = updateDefaultComponents(emptyServiceCompositionDraft(), [draft()]);
    expect(compositionHasIssues(state, ['svc-red'], optional)).toBe(false);

    state = setVariantCustom(state, 'svc-red', true);
    state = updateVariantComponents(state, 'svc-red', [draft({ quantity: '0' })]);
    expect(compositionHasIssues(state, ['svc-red'], optional)).toBe(true);

    state = setVariantCustom(state, 'svc-red', false);
    expect(compositionHasIssues(state, ['svc-red'], optional)).toBe(false);
  });

  it('applies the required-variant rule per Product', () => {
    const state = updateDefaultComponents(emptyServiceCompositionDraft(), [
      draft({ productVariantId: null }),
    ]);
    expect(compositionHasIssues(state, [], () => 'REQUIRED')).toBe(true);
    expect(compositionHasIssues(state, [], () => 'NONE')).toBe(false);
  });
});

describe('componentContribution', () => {
  it('multiplies quantity and price without floating point', () => {
    expect(componentContribution('2', '20000')).toBe('40000.0000');
    expect(componentContribution('2', '18000.5')).toBe('36001.0000');
    expect(componentContribution('3', '0.1')).toBe('0.3000');
    expect(componentContribution('1.5', '0.2')).toBe('0.3000');
  });

  it('returns null for unusable input', () => {
    expect(componentContribution('', '10')).toBeNull();
    expect(componentContribution('1', 'abc')).toBeNull();
  });
});
