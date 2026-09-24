import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionScope,
} from '../../../entities/promotion';
import {
  createPromotionEditorState,
  type PromotionCategoryItemScope,
  type PromotionEditorForm,
  type PromotionEditorState,
  type PromotionEditorStep,
} from './promotion-editor-state';

export type PromotionEditorAction =
  | { type: 'RESET'; promotion: Promotion | null | undefined }
  | {
      type: 'FORM_FIELD_CHANGED';
      field: keyof PromotionEditorForm;
      value: PromotionEditorForm[keyof PromotionEditorForm];
    }
  | { type: 'MODE_CHANGED'; value: PromotionMode }
  | { type: 'DISCOUNT_TYPE_CHANGED'; value: PromotionDiscountType }
  | { type: 'SCOPE_CHANGED'; value: PromotionScope }
  | {
      type: 'CATEGORIES_CHANGED';
      categoryIds: string[];
      itemIds: string[];
    }
  | { type: 'CATEGORY_ITEM_SCOPE_CHANGED'; value: PromotionCategoryItemScope }
  | { type: 'SAVING_CHANGED'; value: boolean }
  | { type: 'STEP_CHANGED'; value: PromotionEditorStep };

export function promotionEditorReducer(
  state: PromotionEditorState,
  action: PromotionEditorAction,
): PromotionEditorState {
  switch (action.type) {
    case 'RESET':
      return createPromotionEditorState(action.promotion);

    case 'FORM_FIELD_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          [action.field]: action.value,
        },
      };

    case 'MODE_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          mode: action.value,
          code: action.value === 'AUTOMATIC' ? '' : state.form.code,
        },
      };

    case 'DISCOUNT_TYPE_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          discountType: action.value,
          maximumDiscount:
            action.value === 'FIXED_AMOUNT' ? '' : state.form.maximumDiscount,
        },
      };

    case 'SCOPE_CHANGED': {
      const nextForm: PromotionEditorForm = {
        ...state.form,
        scope: action.value,
      };

      if (action.value === 'TRANSACTION') {
        nextForm.itemIds = [];
        nextForm.variantIds = [];
        nextForm.categoryIds = [];
        nextForm.categoryItemScope = 'ALL';
      } else if (action.value === 'ITEM') {
        nextForm.categoryIds = [];
        nextForm.categoryItemScope = 'ALL';
      } else {
        nextForm.itemIds = [];
        nextForm.variantIds = [];
        nextForm.categoryItemScope = 'ALL';
      }

      return { ...state, form: nextForm };
    }

    case 'CATEGORIES_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          categoryIds: action.categoryIds,
          itemIds: action.itemIds,
        },
      };

    case 'CATEGORY_ITEM_SCOPE_CHANGED':
      return {
        ...state,
        form: {
          ...state.form,
          categoryItemScope: action.value,
          itemIds: action.value === 'ALL' ? [] : state.form.itemIds,
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

    case 'STEP_CHANGED':
      return {
        ...state,
        ui: {
          ...state.ui,
          step: action.value,
        },
      };
  }
}
