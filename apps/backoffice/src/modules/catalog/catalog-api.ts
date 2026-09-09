import type { ApiClient } from '@digvation/pos-api';

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
}
export interface ItemQuery {
  q?: string;
  type?: 'PRODUCT' | 'SERVICE';
  lifecycle?: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  categoryId?: string;
  limit?: number;
  offset?: number;
}
export interface CategoryQuery {
  q?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  limit?: number;
  offset?: number;
}
export interface NamedRecord {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}
export interface Category extends NamedRecord {}
export interface Variant extends NamedRecord {
  catalogItemId: string;
}
export interface Item {
  id: string;
  code: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE';
  categoryId: string | null;
  taxCategoryId: string | null;
  description: string | null;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  fulfillmentBehavior: 'INSTANT' | 'TRACKED';
  version: number;
  serviceDefinition: {
    defaultDurationMinutes: number | null;
    employeeAssignmentMode: 'NONE' | 'OPTIONAL' | 'REQUIRED';
    allowEmployeeContribution: boolean;
  } | null;
}
export interface CatalogManagementItem extends Item {
  variantCount: number;
}
export interface Price {
  id: string;
  catalogItemId: string;
  catalogVariantId: string | null;
  locationId: string | null;
  currency: string;
  amount: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  cancelledAt: string | null;
}
export interface DefaultPrice {
  catalogItemId: string;
  catalogPriceId: string;
  currency: string;
  amount: string;
}
export interface ResolvedPrice {
  catalogPriceId: string;
  catalogItemId: string;
  catalogVariantId: string | null;
  locationId: string | null;
  currency: string;
  amount: string;
  effectiveAt: string;
  sourceScope: { catalogVariantId: string | null; locationId: string | null };
}

export interface CreateCatalogItemInput extends Omit<
  Item,
  'id' | 'version' | 'code' | 'serviceDefinition' | 'taxCategoryId'
> {
  code?: string;
  taxCategoryId?: string | null;
  serviceDefinition?: Item['serviceDefinition'];
}

const page = '?limit=50&offset=0';
export class CatalogApi {
  constructor(private readonly client: ApiClient) {}
  listItems(query: ItemQuery = {}) {
    return this.client.get<Page<CatalogManagementItem>>(
      `/api/v1/catalog/items?${new URLSearchParams(Object.entries({ limit: 50, offset: 0, ...query }).filter(([, value]) => value !== undefined && value !== '') as [string, string][]).toString()}`,
    );
  }
  getItem(id: string) {
    return this.client.get<Item>(`/api/v1/catalog/items/${id}`);
  }
  createItem(input: CreateCatalogItemInput) {
    return this.client.post<Item>('/api/v1/catalog/items', input);
  }
  updateItem(
    item: Item,
    input: Partial<Omit<Item, 'id' | 'code' | 'type' | 'version' | 'serviceDefinition'>> & {
      serviceDefinition?: Item['serviceDefinition'];
    },
  ) {
    return this.client.patch<Item>(`/api/v1/catalog/items/${item.id}`, {
      expectedVersion: item.version,
      ...input,
    });
  }
  listCategories(query: CategoryQuery = {}) {
    return this.client.get<Page<Category>>(
      `/api/v1/catalog/categories?${new URLSearchParams(Object.entries({ limit: 50, offset: 0, ...query }).filter(([, value]) => value !== undefined && value !== '') as [string, string][]).toString()}`,
    );
  }
  createCategory(input: { code?: string; name: string; status?: Category['status'] }) {
    return this.client.post<Category>('/api/v1/catalog/categories', input);
  }
  updateCategory(item: Category, input: Partial<Pick<Category, 'name' | 'status'>>) {
    return this.client.patch<Category>(`/api/v1/catalog/categories/${item.id}`, {
      expectedVersion: item.version,
      ...input,
    });
  }
  listVariants(itemId: string) {
    return this.client.get<Page<Variant>>(`/api/v1/catalog/items/${itemId}/variants${page}`);
  }
  createVariant(
    itemId: string,
    input: { code?: string; name: string; status?: Variant['status'] },
  ) {
    return this.client.post<Variant>(`/api/v1/catalog/items/${itemId}/variants`, input);
  }
  updateVariant(itemId: string, item: Variant, input: Partial<Pick<Variant, 'name' | 'status'>>) {
    return this.client.patch<Variant>(`/api/v1/catalog/items/${itemId}/variants/${item.id}`, {
      expectedVersion: item.version,
      ...input,
    });
  }
  listPrices(itemId: string) {
    return this.client.get<Page<Price>>(
      `/api/v1/pricing/prices?catalogItemId=${itemId}&limit=50&offset=0`,
    );
  }
  listDefaultPrices(catalogItemIds: string[], currency: string, effectiveAt: string) {
    const query = new URLSearchParams({ currency, effectiveAt });
    catalogItemIds.forEach((catalogItemId) => query.append('catalogItemIds', catalogItemId));
    return this.client.get<{ items: DefaultPrice[] }>(
      `/api/v1/pricing/defaults?${query.toString()}`,
    );
  }
  resolvePrice(input: {
    catalogItemId: string;
    catalogVariantId?: string | null;
    locationId?: string | null;
    currency: string;
    effectiveAt: string;
  }) {
    return this.client.get<ResolvedPrice>(
      `/api/v1/pricing/resolve?${new URLSearchParams(Object.entries(input).filter(([, value]) => value != null) as [string, string][]).toString()}`,
    );
  }
  createPrice(input: {
    catalogItemId: string;
    catalogVariantId?: string | null;
    locationId?: string | null;
    currency: string;
    amount: string;
    effectiveFrom: string;
    effectiveUntil?: string | null;
  }) {
    return this.client.post<Price>('/api/v1/pricing/prices', input);
  }
  changePrice(input: {
    catalogItemId: string;
    catalogVariantId?: string | null;
    locationId?: string | null;
    currency: string;
    amount: string;
    effectiveFrom: string;
  }) {
    return this.client.post<Price>('/api/v1/pricing/prices/change', input);
  }
  cancelPrice(id: string) {
    return this.client.post<Price>(`/api/v1/pricing/prices/${id}/cancel`, {});
  }
}
