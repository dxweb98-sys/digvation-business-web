import { describe, expect, it } from 'vitest';

import type { Category } from '../../api/catalog-api';
import {
  createCatalogCategoryEditorForm,
  toCreateCatalogCategoryInput,
  toUpdateCatalogCategoryInput,
  validateCatalogCategoryEditorForm,
} from './catalog-category-editor-form';

const category: Category = {
  id: 'cat-1',
  code: 'CAT-000001',
  name: 'Minuman',
  status: 'INACTIVE',
  version: 3,
};

describe('catalog category editor form', () => {
  it('starts a new category as active with no code', () => {
    expect(createCatalogCategoryEditorForm(null)).toEqual({
      code: '',
      name: '',
      status: 'ACTIVE',
    });
  });

  it('hydrates an existing category', () => {
    expect(createCatalogCategoryEditorForm(category)).toEqual({
      code: 'CAT-000001',
      name: 'Minuman',
      status: 'INACTIVE',
    });
  });

  it('requires a name', () => {
    const result = validateCatalogCategoryEditorForm(
      { code: '', name: '   ', status: 'ACTIVE' },
      { fresh: true },
    );
    expect(result).toEqual({ valid: false, name: 'NAME_REQUIRED', code: null });
  });

  it('limits the name to the Runtime maximum', () => {
    const result = validateCatalogCategoryEditorForm(
      { code: '', name: 'a'.repeat(161), status: 'ACTIVE' },
      { fresh: true },
    );
    expect(result.name).toBe('NAME_TOO_LONG');
  });

  it('accepts an empty code and a normalized manual code on create', () => {
    expect(
      validateCatalogCategoryEditorForm(
        { code: '', name: 'Kopi', status: 'ACTIVE' },
        { fresh: true },
      ).valid,
    ).toBe(true);
    expect(
      validateCatalogCategoryEditorForm(
        { code: ' kopi-01 ', name: 'Kopi', status: 'ACTIVE' },
        { fresh: true },
      ).valid,
    ).toBe(true);
  });

  it('rejects a manual code outside the Runtime pattern on create', () => {
    const result = validateCatalogCategoryEditorForm(
      { code: 'kopi susu', name: 'Kopi', status: 'ACTIVE' },
      { fresh: true },
    );
    expect(result).toEqual({ valid: false, name: null, code: 'CODE_INVALID' });
  });

  it('requires a valid code on edit', () => {
    expect(
      validateCatalogCategoryEditorForm(
        { code: ' ', name: 'Kopi', status: 'ACTIVE' },
        { fresh: false },
      ).code,
    ).toBe('CODE_REQUIRED');
    expect(
      validateCatalogCategoryEditorForm(
        { code: 'kopi susu', name: 'Kopi', status: 'ACTIVE' },
        { fresh: false },
      ).code,
    ).toBe('CODE_INVALID');
    expect(
      validateCatalogCategoryEditorForm(
        { code: 'kopi-02', name: 'Kopi', status: 'ACTIVE' },
        { fresh: false },
      ).valid,
    ).toBe(true);
  });

  it('omits an empty code on create so Runtime generates one', () => {
    expect(toCreateCatalogCategoryInput({ code: '  ', name: ' Kopi ', status: 'ACTIVE' })).toEqual({
      name: 'Kopi',
      status: 'ACTIVE',
    });
    expect(
      toCreateCatalogCategoryInput({ code: ' kopi-01 ', name: 'Kopi', status: 'INACTIVE' }),
    ).toEqual({ code: 'KOPI-01', name: 'Kopi', status: 'INACTIVE' });
  });

  it('sends the normalized code with name and status on update', () => {
    expect(
      toUpdateCatalogCategoryInput({ code: ' teh-01 ', name: ' Teh ', status: 'INACTIVE' }),
    ).toEqual({ code: 'TEH-01', name: 'Teh', status: 'INACTIVE' });
  });
});
