import { describe, expect, it } from 'vitest';

import {
  catalogItemEditorReducer,
} from './catalog-item-editor-reducer';
import {
  createCatalogItemEditorState,
} from './catalog-item-editor-state';

describe('catalogItemEditorReducer', () => {
  it('keeps related loyalty draft changes together', () => {
    const initial = createCatalogItemEditorState(null);

    const hydrated = catalogItemEditorReducer(initial, {
      type: 'LOYALTY_HYDRATED',
      behavior: 'FIXED',
      pointsPerUnit: '10',
    });

    const changed = catalogItemEditorReducer(hydrated, {
      type: 'LOYALTY_BEHAVIOR_CHANGED',
      behavior: 'EXCLUDED',
    });

    expect(changed.loyalty).toEqual({
      behavior: 'EXCLUDED',
      pointsPerUnit: '10',
      touched: true,
    });
  });

  it('selecting an image cancels a pending image removal', () => {
    const initial = createCatalogItemEditorState(null);

    const removing = catalogItemEditorReducer(initial, {
      type: 'IMAGE_REMOVAL_REQUESTED',
    });

    const file = new File(['image'], 'item.png', { type: 'image/png' });
    const selected = catalogItemEditorReducer(removing, {
      type: 'IMAGE_SELECTED',
      file,
    });

    expect(selected.image.file).toBe(file);
    expect(selected.image.removeRequested).toBe(false);
  });

  it('resets the complete editor state when editing identity changes', () => {
    const dirty = catalogItemEditorReducer(createCatalogItemEditorState(null), {
      type: 'FORM_FIELD_CHANGED',
      field: 'name',
      value: 'Temporary draft',
    });

    const reset = catalogItemEditorReducer(dirty, {
      type: 'RESET',
      item: null,
    });

    expect(reset.form.name).toBe('');
    expect(reset.ui.saving).toBe(false);
    expect(reset.loyalty.touched).toBe(false);
  });
});
