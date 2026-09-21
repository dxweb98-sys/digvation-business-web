import { describe, expect, it } from 'vitest';

import {
  buildCatalogItemBaseInput,
  normalizeOptionalCatalogCode,
} from './catalog-item-editor.mapper';
import { createCatalogItemEditorState } from './catalog-item-editor.state';

describe('catalog item editor mapper', () => {
  it('normalizes optional item code at the command boundary', () => {
    expect(normalizeOptionalCatalogCode(' sku-1 ')).toBe('SKU-1');
    expect(normalizeOptionalCatalogCode('   ')).toBeNull();
  });

  it('maps service-only fields only for service items', () => {
    const state = createCatalogItemEditorState(null);
    const product = buildCatalogItemBaseInput({
      form: state.form,
      hasVariants: false,
      parsedDefaultDuration: null,
    });
    expect(product).not.toHaveProperty('serviceDefinition');
    expect(product.fulfillmentBehavior).toBe('INSTANT');

    const service = buildCatalogItemBaseInput({
      form: { ...state.form, type: 'SERVICE' },
      hasVariants: false,
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
