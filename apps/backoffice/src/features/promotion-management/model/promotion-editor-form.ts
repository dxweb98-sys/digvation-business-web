import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionScope,
  PromotionWriteInput,
} from '../../../entities/promotion';

export type PromotionEditorStep = 'INFORMATION' | 'TARGET';
export type PromotionCategoryItemScope = 'ALL' | 'SELECTED';

export interface PromotionEditorForm {
  name: string;
  enabled: boolean;
  mode: PromotionMode;
  code: string;
  scope: PromotionScope;
  discountType: PromotionDiscountType;
  discountValue: string;
  currency: string;
  maximumDiscount: string;
  minimumPurchase: string;
  effectiveFrom: string;
  effectiveUntil: string;
  itemIds: string[];
  variantIds: string[];
  categoryIds: string[];
  categoryItemScope: PromotionCategoryItemScope;
  locationIds: string[];
}

export function createPromotionEditorForm(
  promotion: Promotion | null | undefined,
): PromotionEditorForm {
  return {
    name: promotion?.name ?? '',
    enabled: promotion?.enabled ?? true,
    mode: promotion?.mode ?? 'AUTOMATIC',
    code: promotion?.code ?? '',
    scope: promotion?.scope ?? 'TRANSACTION',
    discountType: promotion?.discountType ?? 'PERCENTAGE',
    discountValue:
      promotion?.discountType === 'PERCENTAGE'
        ? String(Number(promotion.discountValue) * 100)
        : (promotion?.discountValue ?? ''),
    currency: promotion?.currency ?? 'IDR',
    maximumDiscount: promotion?.maximumDiscount ?? '',
    minimumPurchase: promotion?.minimumPurchase ?? '',
    effectiveFrom: promotion?.effectiveFrom ?? '',
    effectiveUntil: promotion?.effectiveUntil ?? '',
    itemIds: promotion?.itemIds ?? [],
    variantIds: promotion?.variantIds ?? [],
    categoryIds: promotion?.categoryIds ?? [],
    categoryItemScope:
      promotion?.scope === 'CATEGORY' && promotion.itemIds.length > 0 ? 'SELECTED' : 'ALL',
    locationIds: promotion?.locationIds ?? [],
  };
}


export interface PromotionEditorValidation {
  valid: boolean;
  periodValid: boolean;
}

export function validatePromotionEditorForm(
  form: PromotionEditorForm,
): PromotionEditorValidation {
  const numericValue = Number(form.discountValue);
  const numericMaximum = form.maximumDiscount ? Number(form.maximumDiscount) : null;
  const numericMinimum = form.minimumPurchase ? Number(form.minimumPurchase) : null;
  const needsCurrency =
    form.discountType === 'FIXED_AMOUNT' ||
    form.maximumDiscount !== '' ||
    form.minimumPurchase !== '';
  const currencyValid =
    !needsCurrency || /^[A-Z]{3}$/.test(form.currency.trim().toUpperCase());
  const targetValid =
    form.scope === 'TRANSACTION' ||
    (form.scope === 'ITEM' && (form.itemIds.length > 0 || form.variantIds.length > 0)) ||
    (form.scope === 'CATEGORY' &&
      form.categoryIds.length > 0 &&
      (form.categoryItemScope === 'ALL' || form.itemIds.length > 0));
  const valueValid =
    Number.isFinite(numericValue) &&
    numericValue > 0 &&
    (form.discountType === 'FIXED_AMOUNT' || numericValue <= 100);
  const maximumValid =
    numericMaximum === null ||
    (form.discountType === 'PERCENTAGE' &&
      Number.isFinite(numericMaximum) &&
      numericMaximum > 0);
  const minimumValid =
    numericMinimum === null ||
    (Number.isFinite(numericMinimum) && numericMinimum >= 0);
  const periodValid =
    !form.effectiveFrom ||
    !form.effectiveUntil ||
    new Date(form.effectiveUntil).getTime() > new Date(form.effectiveFrom).getTime();

  return {
    periodValid,
    valid:
      form.name.trim().length > 0 &&
      (form.mode === 'AUTOMATIC' || form.code.trim().length > 0) &&
      valueValid &&
      maximumValid &&
      minimumValid &&
      currencyValid &&
      targetValid &&
      periodValid,
  };
}

export function toPromotionWriteInput(form: PromotionEditorForm): PromotionWriteInput {
  const numericValue = Number(form.discountValue);

  return {
    name: form.name.trim(),
    enabled: form.enabled,
    mode: form.mode,
    code: form.mode === 'CODE' ? form.code.trim().toUpperCase() : null,
    scope: form.scope,
    discountType: form.discountType,
    discountValue:
      form.discountType === 'PERCENTAGE'
        ? String(numericValue / 100)
        : form.discountValue.trim(),
    currency: form.currency.trim() ? form.currency.trim().toUpperCase() : null,
    maximumDiscount: form.maximumDiscount.trim() || null,
    minimumPurchase: form.minimumPurchase.trim() || null,
    effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : null,
    effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null,
    itemIds:
      form.scope === 'ITEM' ||
      (form.scope === 'CATEGORY' && form.categoryItemScope === 'SELECTED')
        ? form.itemIds
        : [],
    variantIds: form.scope === 'ITEM' ? form.variantIds : [],
    categoryIds: form.scope === 'CATEGORY' ? form.categoryIds : [],
    locationIds: form.locationIds,
  };
}
