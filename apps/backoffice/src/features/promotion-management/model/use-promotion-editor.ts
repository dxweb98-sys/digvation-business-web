import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionReferenceOption,
  PromotionScope,
} from '../../../entities/promotion';
import { useFormState } from '../../../shared/forms/use-form-state';
import {
  createPromotionEditorForm,
  type PromotionCategoryItemScope,
  type PromotionEditorStep,
} from './promotion-editor-form';

function promotionEditorIdentity(promotion: Promotion | null | undefined) {
  if (promotion === undefined) return 'closed';
  if (promotion === null) return 'new';
  return promotion.id;
}

export function usePromotionEditor(promotion: Promotion | null | undefined) {
  const {
    values,
    setField,
    patch,
    reset,
  } = useFormState(() => createPromotionEditorForm(promotion));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<PromotionEditorStep>('INFORMATION');

  const identity = promotionEditorIdentity(promotion);
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;

    previousIdentityRef.current = identity;
    reset(createPromotionEditorForm(promotion));
    setSaving(false);
    setStep('INFORMATION');
  }, [identity, promotion, reset]);

  const changeMode = useCallback(
    (value: PromotionMode) => {
      patch({
        mode: value,
        ...(value === 'AUTOMATIC' ? { code: '' } : {}),
      });
    },
    [patch],
  );

  const changeDiscountType = useCallback(
    (value: PromotionDiscountType) => {
      patch({
        discountType: value,
        ...(value === 'FIXED_AMOUNT' ? { maximumDiscount: '' } : {}),
      });
    },
    [patch],
  );

  const changeScope = useCallback(
    (value: PromotionScope) => {
      if (value === 'TRANSACTION') {
        patch({
          scope: value,
          itemIds: [],
          variantIds: [],
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      if (value === 'ITEM') {
        patch({
          scope: value,
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      patch({
        scope: value,
        itemIds: [],
        variantIds: [],
        categoryItemScope: 'ALL',
      });
    },
    [patch],
  );

  const changeCategories = useCallback(
    (categoryIds: string[], items: PromotionReferenceOption[]) => {
      const selectedCategories = new Set(categoryIds);
      const itemIds = values.itemIds.filter((itemId) => {
        const option = items.find((item) => item.id === itemId);
        return Boolean(option?.categoryId && selectedCategories.has(option.categoryId));
      });

      patch({ categoryIds, itemIds });
    },
    [patch, values.itemIds],
  );

  const changeCategoryItemScope = useCallback(
    (value: PromotionCategoryItemScope) => {
      patch({
        categoryItemScope: value,
        ...(value === 'ALL' ? { itemIds: [] } : {}),
      });
    },
    [patch],
  );

  return {
    form: values,
    ui: {
      saving,
      step,
    },
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
