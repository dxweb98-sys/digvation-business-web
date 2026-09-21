import type { CatalogItem, VariantSelectionMode } from '@digvation/business-catalog';

import type { VariantPriceDraft } from '../../../modules/catalog/catalog-variant-price-draft';
import type { LoyaltyEarningBehavior } from '../../../modules/loyalty/loyalty-api';

export interface CatalogItemEditorForm {
  code: string;
  name: string;
  type: CatalogItem['type'];
  categoryId: string | null;
  description: string;
  lifecycle: CatalogItem['lifecycle'];
  defaultDurationMinutes: string;
  variantSelectionMode: VariantSelectionMode;
  defaultPrice: string;
  variants: VariantPriceDraft[];
}

export interface CatalogItemEditorLoyaltyDraft {
  behavior: LoyaltyEarningBehavior;
  pointsPerUnit: string;
  touched: boolean;
}

export interface CatalogItemEditorImageDraft {
  file: File | null;
  removeRequested: boolean;
}

export interface CatalogItemEditorUiState {
  showIssues: boolean;
  saving: boolean;
}

export interface CatalogItemEditorState {
  form: CatalogItemEditorForm;
  loyalty: CatalogItemEditorLoyaltyDraft;
  image: CatalogItemEditorImageDraft;
  ui: CatalogItemEditorUiState;
}

export function createCatalogItemEditorState(
  item: CatalogItem | null | undefined,
): CatalogItemEditorState {
  return {
    form: {
      code: item?.code ?? '',
      name: item?.name ?? '',
      type: item?.type ?? 'PRODUCT',
      categoryId: item?.categoryId ?? null,
      description: item?.description ?? '',
      lifecycle: item?.lifecycle ?? 'DRAFT',
      defaultDurationMinutes:
        item?.serviceDefinition?.defaultDurationMinutes?.toString() ?? '',
      variantSelectionMode: item?.variantSelectionMode ?? 'REQUIRED',
      defaultPrice: '',
      variants: [],
    },
    loyalty: {
      behavior: 'FIXED',
      pointsPerUnit: '',
      touched: false,
    },
    image: {
      file: null,
      removeRequested: false,
    },
    ui: {
      showIssues: false,
      saving: false,
    },
  };
}
