import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../shared/api/build-query-string';

/** Initial supported commission model: a fixed amount per sold unit. */
export type ProductCommissionType = 'FIXED_PER_UNIT';

export interface ProductCommissionRule {
  catalogItemId: string;
  type: ProductCommissionType;
  /** Exact NUMERIC(19,4) text in the business currency. */
  commissionPerUnit: string;
  currency: string;
  itemCode: string;
  itemName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCommissionRulePage {
  items: ProductCommissionRule[];
  total: number;
  limit: number;
  offset: number;
}

export interface SetProductCommissionInput {
  /** 0 creates the configuration; otherwise the current version. */
  expectedVersion: number;
  commissionPerUnit: string;
}

export class ProductCommissionApi {
  public constructor(private readonly client: ApiClient) {}

  listRules(query: { limit: number; offset: number }) {
    return this.client.get<ProductCommissionRulePage>(
      `/api/v1/commission/product-rules?${buildQueryString(query)}`,
    );
  }

  setRule(catalogItemId: string, input: SetProductCommissionInput) {
    return this.client.put<ProductCommissionRule>(
      `/api/v1/commission/product-rules/${catalogItemId}`,
      input,
    );
  }

  removeRule(rule: Pick<ProductCommissionRule, 'catalogItemId' | 'version'>) {
    return this.client.delete<ProductCommissionRule>(
      `/api/v1/commission/product-rules/${rule.catalogItemId}?expectedVersion=${rule.version}`,
    );
  }
}
