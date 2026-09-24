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
  const form = useFormState(() => createPromotionEditorForm(promotion));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<PromotionEditorStep>('INFORMATION');

  const identity = promotionEditorIdentity(promotion);
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;

    previousIdentityRef.current = identity;
    form.reset(createPromotionEditorForm(promotion));
    setSaving(false);
    setStep('INFORMATION');
  }, [form.reset, identity, promotion]);

  const changeMode = useCallback(
    (value: PromotionMode) => {
      form.patch({
        mode: value,
        ...(value === 'AUTOMATIC' ? { code: '' } : {}),
      });
    },
    [form.patch],
  );

  const changeDiscountType = useCallback(
    (value: PromotionDiscountType) => {
      form.patch({
        discountType: value,
        ...(value === 'FIXED_AMOUNT' ? { maximumDiscount: '' } : {}),
      });
    },
    [form.patch],
  );

  const changeScope = useCallback(
    (value: PromotionScope) => {
      if (value === 'TRANSACTION') {
        form.patch({
          scope: value,
          itemIds: [],
          variantIds: [],
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      if (value === 'ITEM') {
        form.patch({
          scope: value,
          categoryIds: [],
          categoryItemScope: 'ALL',
        });
        return;
      }

      form.patch({
        scope: value,
        itemIds: [],
        variantIds: [],
        categoryItemScope: 'ALL',
      });
    },
    [form.patch],
  );

  const changeCategories = useCallback(
    (categoryIds: string[], items: PromotionReferenceOption[]) => {
      const selectedCategories = new Set(categoryIds);
      const itemIds = form.values.itemIds.filter((itemId) => {
        const option = items.find((item) => item.id === itemId);
        return Boolean(option?.categoryId && selectedCategories.has(option.categoryId));
      });

      form.patch({ categoryIds, itemIds });
    },
    [form.patch, form.values.itemIds],
  );

  const changeCategoryItemScope = useCallback(
    (value: PromotionCategoryItemScope) => {
      form.patch({
        categoryItemScope: value,
        ...(value === 'ALL' ? { itemIds: [] } : {}),
      });
    },
    [form.patch],
  );

  return {
    form,
    ui: {
      saving,
      step,
      setSaving,
      setStep,
    },
    actions: {
      changeMode,
      changeDiscountType,
      changeScope,
      changeCategories,
      changeCategoryItemScope,
    },
  };
}
