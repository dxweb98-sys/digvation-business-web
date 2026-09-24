import type {
  Promotion,
  PromotionDiscountType,
  PromotionMode,
  PromotionScope,
} from '../model/promotion.types';

export interface PromotionReferenceOption {
  id: string;
  code: string;
  name: string;

  categoryId?: string | null;
  catalogItemId?: string | null;
}

export interface PromotionReferenceOptions {
  items: PromotionReferenceOption[];
  variants: PromotionReferenceOption[];
  categories: PromotionReferenceOption[];
  locations: PromotionReferenceOption[];
}

export interface PromotionWriteInput {
  name: string;
  enabled: boolean;

  mode: PromotionMode;
  code: string | null;

  scope: PromotionScope;

  discountType: PromotionDiscountType;
  discountValue: string;

  currency: string | null;
  maximumDiscount: string | null;
  minimumPurchase: string | null;

  effectiveFrom: string | null;
  effectiveUntil: string | null;

  itemIds: string[];
  variantIds: string[];
  categoryIds: string[];
  locationIds: string[];
}

export interface PromotionListQuery {
  limit?: number;
  offset?: number;
}

export interface PromotionPage {
  items: Promotion[];
  total: number;
  limit: number;
  offset: number;
}
