import type { Item, ProductUsage, VariantSelectionMode } from '../../api/catalog-api';

import {
  emptyServiceCompositionDraft,
  type ServiceCompositionDraft,
} from './service-composition-draft';
import type { VariantPriceDraft } from './variant-price-draft';
import type { LoyaltyEarningBehavior } from '../../../../modules/loyalty/loyalty-api';

export interface CatalogItemEditorSource {
  id: string;
  code: string;
  name: string;
  type: Item['type'];
  categoryId: string | null;
  description: string | null;
  lifecycle: Item['lifecycle'];
  variantSelectionMode: VariantSelectionMode;
  productUsage: ProductUsage;
  requireAdditionalItemAtSale?: boolean;
  serviceDefinition: {
    defaultDurationMinutes: number | null;
  } | null;
}

export interface CatalogItemEditorForm {
  code: string;
  name: string;
  type: Item['type'];
  categoryId: string | null;
  description: string;
  lifecycle: Item['lifecycle'];
  defaultDurationMinutes: string;
  variantSelectionMode: VariantSelectionMode;
  /** PRODUCT only. Off means component-only: usable in Service compositions, never sold alone. */
  directlySellable: boolean;
  /** Product or Service: the operator must add at least one additional item at Sale time. */
  requireAdditionalItemAtSale: boolean;
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
  composition: ServiceCompositionDraft;
  loyalty: CatalogItemEditorLoyaltyDraft;
  image: CatalogItemEditorImageDraft;
  ui: CatalogItemEditorUiState;
}

export function createCatalogItemEditorState(
  item: CatalogItemEditorSource | null | undefined,
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
      variantSelectionMode: item?.variantSelectionMode ?? 'OPTIONAL',
      directlySellable: item?.productUsage !== 'COMPONENT_ONLY',
      requireAdditionalItemAtSale: item?.requireAdditionalItemAtSale === true,
      defaultPrice: '',
      variants: [],
    },
    composition: emptyServiceCompositionDraft(),
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
