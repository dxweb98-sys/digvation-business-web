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
        serviceDefinition: { defaultDurationMinutes: 30 },
      }),
    );
  });
});
