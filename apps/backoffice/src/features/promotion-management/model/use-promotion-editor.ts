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
  const formState = useFormState(() => createPromotionEditorForm(promotion));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<PromotionEditorStep>('INFORMATION');

  const identity = promotionEditorIdentity(promotion);
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;

    previousIdentityRef.current = identity;
    formState.reset(createPromotionEditorForm(promotion));
    setSaving(false);
    setStep('INFORMATION');
  }, [formState.reset, identity, promotion]);

  const changeMode = useCallback(
    (value: PromotionMode) => {
      formState.patch({
        mode: value,
        ...(value === 'AUTOMATIC' ? { code: '' } : {}),
      });
    },
    [formState.patch],
  );

  const changeDiscountType = useCallback(
    (value: PromotionDiscountType) => {
      formState.patch({
        discountType: value,
        ...(value === 'FIXED_AMOUNT' ? { maximumDiscount: '' } : {}),
      });
    },
    [formState.patch],
  );

  const changeScope = useCallback(
    (value: PromotionScope) => {
      if (value === 'TRANSACTION') {
        formState.patch({
          scope: value,
          itemIds: [],
          variantIds: [],
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      if (value === 'ITEM') {
        formState.patch({
          scope: value,
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      formState.patch({
        scope: value,
        itemIds: [],
        variantIds: [],
        categoryItemScope: 'ALL',
      });
    },
    [formState.patch],
  );

  const changeCategories = useCallback(
    (categoryIds: string[], items: PromotionReferenceOption[]) => {
      const selectedCategories = new Set(categoryIds);
      const itemIds = formState.values.itemIds.filter((itemId) => {
        const option = items.find((item) => item.id === itemId);
        return Boolean(option?.categoryId && selectedCategories.has(option.categoryId));
      });

      formState.patch({ categoryIds, itemIds });
    },
    [formState.patch, formState.values.itemIds],
  );

  const changeCategoryItemScope = useCallback(
    (value: PromotionCategoryItemScope) => {
      formState.patch({
        categoryItemScope: value,
        ...(value === 'ALL' ? { itemIds: [] } : {}),
      });
    },
    [formState.patch],
  );

  return {
    form: formState.values,
    setField: formState.setField,
    ui: {
      saving,
      step,
    },
    actions: {
      setSaving,
      setStep,
      changeMode,
      changeDiscountType,
      changeScope,
      changeCategories,
      changeCategoryItemScope,
    },
  };
}
