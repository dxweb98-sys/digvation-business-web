import { ApiClient } from '@digvation/business-api';

export interface TaxProfile {
  itemTaxEnabled: boolean;
  transactionTaxEnabled: boolean;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TaxCategory {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRule {
  id: string;
  scope: 'ITEM' | 'TRANSACTION';
  taxCategoryId: string | null;
  code: string;
  name: string;
  rate: string;
  priceTreatment: 'INCLUDED' | 'EXCLUDED';
  effectiveFrom: string;
  effectiveUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export class TaxApi {
  public constructor(private readonly client: ApiClient) {}

  profile() {
    return this.client.get<TaxProfile>('/api/v1/tax/profile');
  }

  updateProfile(profile: TaxProfile, input: Pick<TaxProfile, 'itemTaxEnabled' | 'transactionTaxEnabled'>) {
    return this.client.patch<TaxProfile>('/api/v1/tax/profile', {
      expectedVersion: profile.version,
      ...input,
    });
  }

  categories() {
    return this.client.get<Page<TaxCategory>>('/api/v1/tax/categories?limit=100&offset=0');
  }

  createCategory(input: { code: string; name: string }) {
    return this.client.post<TaxCategory>('/api/v1/tax/categories', {
      ...input,
      status: 'ACTIVE',
    });
  }

  updateCategory(category: TaxCategory, input: { name?: string; status?: TaxCategory['status'] }) {
    return this.client.patch<TaxCategory>(`/api/v1/tax/categories/${category.id}`, {
      expectedVersion: category.version,
      ...input,
    });
  }

  rules() {
    return this.client.get<Page<TaxRule>>('/api/v1/tax/rules?limit=100&offset=0');
  }

  createRule(input: {
    scope: TaxRule['scope'];
    taxCategoryId?: string | null;
    code: string;
    name: string;
    rate: string;
    priceTreatment: TaxRule['priceTreatment'];
    effectiveFrom: string;
    effectiveUntil?: string | null;
  }) {
    return this.client.post<TaxRule>('/api/v1/tax/rules', input);
  }

  cancelRule(id: string) {
    return this.client.post<TaxRule>(`/api/v1/tax/rules/${id}/cancel`, {});
  }
}
