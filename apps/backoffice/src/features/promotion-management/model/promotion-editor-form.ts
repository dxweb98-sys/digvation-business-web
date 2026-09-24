import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionScope,
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
