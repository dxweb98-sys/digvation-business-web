import type { ApiClient } from '@digvation/business-api';

export type PromotionMode = 'AUTOMATIC' | 'CODE';
export type PromotionScope = 'ITEM' | 'CATEGORY' | 'TRANSACTION';
export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED';

export interface PromotionReferenceOption {
  id: string;
  code: string;
  name: string;
  categoryId?: string | null;
}

export interface PromotionReferenceOptions {
  items: PromotionReferenceOption[];
  categories: PromotionReferenceOption[];
  locations: PromotionReferenceOption[];
}

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
  categoryIds: string[];
  locationIds: string[];
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
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
  categoryIds: string[];
  locationIds: string[];
}

export interface PromotionPage {
  items: Promotion[];
  total: number;
  limit: number;
  offset: number;
}

export class PromotionsApi {
  public constructor(private readonly client: ApiClient) {}

  list() {
    return this.client.get<PromotionPage>('/api/v1/promotions?limit=100&offset=0');
  }

  options() {
    return this.client.get<PromotionReferenceOptions>('/api/v1/promotions/options');
  }

  create(input: PromotionWriteInput) {
    return this.client.post<Promotion>('/api/v1/promotions', input);
  }

  update(promotion: Promotion, input: PromotionWriteInput) {
    return this.client.patch<Promotion>(`/api/v1/promotions/${promotion.id}`, {
      expectedVersion: promotion.version,
      ...input,
    });
  }
}
