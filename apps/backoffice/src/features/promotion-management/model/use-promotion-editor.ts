import { useCallback, useEffect, useReducer, useRef } from 'react';

import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionReferenceOption,
  PromotionScope,
} from '../../../entities/promotion';
import { promotionEditorReducer } from './promotion-editor-reducer';
import {
  createPromotionEditorState,
  type PromotionCategoryItemScope,
  type PromotionEditorForm,
  type PromotionEditorStep,
} from './promotion-editor-state';

function promotionEditorIdentity(promotion: Promotion | null | undefined) {
  if (promotion === undefined) return 'closed';
  if (promotion === null) return 'new';
  return promotion.id;
}

export function usePromotionEditor(promotion: Promotion | null | undefined) {
  const [state, dispatch] = useReducer(
    promotionEditorReducer,
    promotion,
    createPromotionEditorState,
  );

  const identity = promotionEditorIdentity(promotion);
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;
    previousIdentityRef.current = identity;
    dispatch({ type: 'RESET', promotion });
  }, [identity, promotion]);

  const setField = useCallback(
    <K extends keyof PromotionEditorForm>(
      field: K,
      value: PromotionEditorForm[K],
    ) => {
      dispatch({ type: 'FORM_FIELD_CHANGED', field, value });
    },
    [],
  );

  const changeMode = useCallback((value: PromotionMode) => {
    dispatch({ type: 'MODE_CHANGED', value });
  }, []);

  const changeDiscountType = useCallback((value: PromotionDiscountType) => {
    dispatch({ type: 'DISCOUNT_TYPE_CHANGED', value });
  }, []);

  const changeScope = useCallback((value: PromotionScope) => {
    dispatch({ type: 'SCOPE_CHANGED', value });
  }, []);

  const changeCategories = useCallback(
    (categoryIds: string[], items: PromotionReferenceOption[]) => {
      const selectedCategories = new Set(categoryIds);
      const itemIds = state.form.itemIds.filter((itemId) => {
        const option = items.find((item) => item.id === itemId);
        return Boolean(option?.categoryId && selectedCategories.has(option.categoryId));
      });

      dispatch({ type: 'CATEGORIES_CHANGED', categoryIds, itemIds });
    },
    [state.form.itemIds],
  );

  const changeCategoryItemScope = useCallback((value: PromotionCategoryItemScope) => {
    dispatch({ type: 'CATEGORY_ITEM_SCOPE_CHANGED', value });
  }, []);

  const setSaving = useCallback((value: boolean) => {
    dispatch({ type: 'SAVING_CHANGED', value });
  }, []);

  const setStep = useCallback((value: PromotionEditorStep) => {
    dispatch({ type: 'STEP_CHANGED', value });
  }, []);

  return {
    form: state.form,
    ui: state.ui,
    actions: {
      setField,
      changeMode,
      changeDiscountType,
      changeScope,
      changeCategories,
      changeCategoryItemScope,
      setSaving,
      setStep,
    },
  };
}
