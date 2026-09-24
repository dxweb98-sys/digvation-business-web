export type PromotionMode = 'AUTOMATIC' | 'CODE';
export type PromotionScope = 'ITEM' | 'CATEGORY' | 'TRANSACTION';
export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED';

export interface Promotion {
  id: string;
  name: string;
  enabled: boolean;
  mode: PromotionMode;
  code: string | null;
  scope: PromotionScope;
  audience: 'ALL';
  discountType: PromotionDiscountType;
  discountValue: string;
  currency: string | null;
  maximumDiscount: string | null;
  minimumPurchase: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  version: number;
  itemIds: string[];
  variantIds: string[];
  categoryIds: string[];
  locationIds: string[];
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
}
