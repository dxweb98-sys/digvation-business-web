import { describe, expect, it } from 'vitest';

import {
  buildCatalogItemBaseInput,
  normalizeOptionalCatalogCode,
} from './catalog-item-editor-mapper';
import { createCatalogItemEditorState } from './catalog-item-editor-state';

describe('catalog item editor mapper', () => {
  it('normalizes optional item code at the command boundary', () => {
    expect(normalizeOptionalCatalogCode(' sku-1 ')).toBe('SKU-1');
    expect(normalizeOptionalCatalogCode('   ')).toBeNull();
  });

  it('maps service-only fields only for service items', () => {
    const state = createCatalogItemEditorState(null);
    const product = buildCatalogItemBaseInput({
      form: state.form,
      parsedDefaultDuration: null,
    });
    expect(product).not.toHaveProperty('serviceDefinition');
    expect(product.fulfillmentBehavior).toBe('INSTANT');
    expect(product.variantSelectionMode).toBe('OPTIONAL');

    const service = buildCatalogItemBaseInput({
      form: { ...state.form, type: 'SERVICE' },
      parsedDefaultDuration: 30,
    });
    expect(service).toEqual(
      expect.objectContaining({
        fulfillmentBehavior: 'TRACKED',
        requireAdditionalItemAtSale: false,
        serviceDefinition: { defaultDurationMinutes: 30 },
      }),
    );
  });

  it('defaults a new Product to directly sellable and maps component-only explicitly', () => {
    const state = createCatalogItemEditorState(null);
    expect(state.form.directlySellable).toBe(true);
    expect(
      buildCatalogItemBaseInput({ form: state.form, parsedDefaultDuration: null }).productUsage,
    ).toBe('STANDALONE_AND_COMPONENT');
    expect(
      buildCatalogItemBaseInput({
        form: { ...state.form, directlySellable: false },
        parsedDefaultDuration: null,
      }).productUsage,
    ).toBe('COMPONENT_ONLY');
  });

  it('hydrates an existing component-only Product as not directly sellable', () => {
    const state = createCatalogItemEditorState({
      id: 'p',
      code: 'CAP',
      name: 'Disposable Cap',
      type: 'PRODUCT',
      categoryId: null,
      description: null,
      lifecycle: 'ACTIVE',
      variantSelectionMode: 'OPTIONAL',
      productUsage: 'COMPONENT_ONLY',
      serviceDefinition: null,
    });
    expect(state.form.directlySellable).toBe(false);
  });

  it('keeps the additional-item requirement OFF for an existing Service without the setting', () => {
    const state = createCatalogItemEditorState({
      id: 's',
      code: 'SVC',
      name: 'Creambath',
      type: 'SERVICE',
      categoryId: null,
      description: null,
      lifecycle: 'ACTIVE',
      variantSelectionMode: 'OPTIONAL',
      productUsage: 'STANDALONE_AND_COMPONENT',
      serviceDefinition: { defaultDurationMinutes: null },
    });
    expect(state.form.requireAdditionalItemAtSale).toBe(false);
  });

  it('persists the additional-item requirement through mapper and reopen', () => {
    const state = createCatalogItemEditorState(null);
    const submitted = buildCatalogItemBaseInput({
      form: { ...state.form, type: 'SERVICE', requireAdditionalItemAtSale: true },
      parsedDefaultDuration: null,
    });
    expect(submitted.requireAdditionalItemAtSale).toBe(true);
    expect(submitted.serviceDefinition).toEqual({ defaultDurationMinutes: null });
    // A Product carries the same item-level setting.
    expect(
      buildCatalogItemBaseInput({
        form: { ...state.form, type: 'PRODUCT', requireAdditionalItemAtSale: true },
        parsedDefaultDuration: null,
      }).requireAdditionalItemAtSale,
    ).toBe(true);

    // Reopening the saved Service shows the setting ON again.
    const reopened = createCatalogItemEditorState({
      id: 's',
      code: 'SVC',
      name: 'Hair Color',
      type: 'SERVICE',
      categoryId: null,
      description: null,
      lifecycle: 'ACTIVE',
      variantSelectionMode: 'OPTIONAL',
      productUsage: 'STANDALONE_AND_COMPONENT',
      requireAdditionalItemAtSale: submitted.requireAdditionalItemAtSale,
      serviceDefinition: submitted.serviceDefinition ?? null,
    });
    expect(reopened.form.requireAdditionalItemAtSale).toBe(true);
  });

  it('never sends product usage for a Service', () => {
    const state = createCatalogItemEditorState(null);
    const service = buildCatalogItemBaseInput({
      form: { ...state.form, type: 'SERVICE', directlySellable: false },
      parsedDefaultDuration: null,
    });
    expect(service).not.toHaveProperty('productUsage');
  });
});
