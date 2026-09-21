import type { VariantPriceDraft } from './variant-price-draft';
import type { LoyaltyEarningBehavior } from '../../../modules/loyalty/loyalty-api';
import {
  createCatalogItemEditorState,
  type CatalogItemEditorForm,
  type CatalogItemEditorSource,
  type CatalogItemEditorState,
} from './catalog-item-editor.state';

export type CatalogItemEditorAction =
  | {
      type: 'RESET';
      item: CatalogItemEditorSource | null | undefined;
    }
  | {
      type: 'FORM_FIELD_CHANGED';
      field: keyof CatalogItemEditorForm;
      value: CatalogItemEditorForm[keyof CatalogItemEditorForm];
    }
  | {
      type: 'DEFAULT_PRICE_HYDRATED';
      value: string;
    }
  | {
      type: 'VARIANTS_HYDRATED';
      variants: VariantPriceDraft[];
    }
  | {
      type: 'LOYALTY_HYDRATED';
      behavior: LoyaltyEarningBehavior;
      pointsPerUnit: string;
    }
  | {
      type: 'LOYALTY_BEHAVIOR_CHANGED';
      behavior: LoyaltyEarningBehavior;
    }
  | {
      type: 'LOYALTY_POINTS_CHANGED';
      pointsPerUnit: string;
    }
  | {
      type: 'IMAGE_SELECTED';
      file: File | null;
    }
  | {
      type: 'IMAGE_REMOVAL_REQUESTED';
    }
  | {
      type: 'SHOW_ISSUES_CHANGED';
      value: boolean;
    }
  | {
      type: 'SAVING_CHANGED';
      value: boolean;
    };

export function catalogItemEditorReducer(
  state: CatalogItemEditorState,
  action: CatalogItemEditorAction,
): CatalogItemEditorState {
  switch (action.type) {
    case 'RESET':
      return createCatalogItemEditorState(action.item);

    case 'FORM_FIELD_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          [action.field]: action.value,
        },
      };

    case 'DEFAULT_PRICE_HYDRATED':
      return {
        ...state,
        form: {
          ...state.form,
          defaultPrice: action.value,
        },
      };

    case 'VARIANTS_HYDRATED':
      return {
        ...state,
        form: {
          ...state.form,
          variants: action.variants,
        },
      };

    case 'LOYALTY_HYDRATED':
      return {
        ...state,
        loyalty: {
          behavior: action.behavior,
          pointsPerUnit: action.pointsPerUnit,
          touched: false,
        },
      };

    case 'LOYALTY_BEHAVIOR_CHANGED':
      return {
        ...state,
        loyalty: {
          ...state.loyalty,
          behavior: action.behavior,
          touched: true,
        },
      };

    case 'LOYALTY_POINTS_CHANGED':
      return {
        ...state,
        loyalty: {
          ...state.loyalty,
          pointsPerUnit: action.pointsPerUnit,
          touched: true,
        },
      };

    case 'IMAGE_SELECTED':
      return {
        ...state,
        image: {
          file: action.file,
          removeRequested: action.file ? false : state.image.removeRequested,
        },
      };

    case 'IMAGE_REMOVAL_REQUESTED':
      return {
        ...state,
        image: {
          file: null,
          removeRequested: true,
        },
      };

    case 'SHOW_ISSUES_CHANGED':
      return {
        ...state,
        ui: {
          ...state.ui,
          showIssues: action.value,
        },
      };

    case 'SAVING_CHANGED':
      return {
        ...state,
        ui: {
          ...state.ui,
          saving: action.value,
        },
      };
  }
}
