import type { ApiClient } from '@digvation/business-api';

import { buildQueryString } from '../../../shared/api/build-query-string';

export const CATALOG_IMAGE_MAX_BYTES = 1024 * 1024;
export const CATALOG_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type CatalogImageContentType = (typeof CATALOG_IMAGE_CONTENT_TYPES)[number];

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  total?: number;
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
export type Category = NamedRecord;
export interface Variant extends NamedRecord {
  catalogItemId: string;
}
export interface Item {
  id: string;
  code: string;
  name: string;
  type: 'PRODUCT' | 'SERVICE';
  categoryId: string | null;
  description: string | null;
  lifecycle: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  fulfillmentBehavior: 'INSTANT' | 'TRACKED';
  /** With active variants: REQUIRED sells variants only; OPTIONAL also sells the item itself. */
  variantSelectionMode: VariantSelectionMode;
  version: number;
  serviceDefinition: {
    defaultDurationMinutes: number | null;
  } | null;
}
export interface CatalogManagementItem extends Item {
  variantCount: number;
  image?: CatalogItemImage | null;
}
export interface CatalogItemImage {
  catalogItemId: string;
  contentType: CatalogImageContentType;
  sizeBytes: number;
  updatedAt: string;
  url: string;
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
  createdAt: string;
}
/** Item price history row: item price and variant price changes share one Catalog-owned history. */
export interface PriceHistoryEntry extends Price {
  catalogVariantCode: string | null;
  catalogVariantName: string | null;
  previousAmount: string | null;
  changedBy: { id: string; kind: string; displayName: string | null } | null;
}
export interface VariantPriceChange {
  catalogVariantId: string;
  changed: boolean;
  price: Price;
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

export type VariantSelectionMode = 'REQUIRED' | 'OPTIONAL';

export interface CreateCatalogItemInput extends Omit<
  Item,
  'id' | 'version' | 'code' | 'serviceDefinition' | 'variantSelectionMode'
> {
  variantSelectionMode?: VariantSelectionMode;
  code?: string;
  serviceDefinition?: Item['serviceDefinition'];
}

const page = '?limit=50&offset=0';
export class CatalogApi {
  private readonly itemImages = new Map<string, CatalogItemImage | null>();

  constructor(private readonly client: ApiClient) {}
  async listItems(query: ItemQuery = {}) {
    const result = await this.client.get<Page<CatalogManagementItem>>(
      `/api/v1/catalog/items?${buildQueryString({ limit: 50, offset: 0, ...query })}`,
    );
    result.items.forEach((item) => {
      if (item.image !== undefined) this.itemImages.set(item.id, item.image);
    });
    return result;
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
  getItemImage(itemId: string) {
    if (this.itemImages.has(itemId)) {
      return Promise.resolve(this.itemImages.get(itemId) ?? null);
    }
    return this.client.get<CatalogItemImage | null>(`/api/v1/catalog/items/${itemId}/image`);
  }
  async replaceItemImage(itemId: string, file: File) {
    const image = await this.client.putBinary<CatalogItemImage>(
      `/api/v1/catalog/items/${itemId}/image`,
      file,
      file.type,
    );
    this.itemImages.set(itemId, image);
    return image;
  }
  async removeItemImage(itemId: string) {
    const result = await this.client.delete<null>(`/api/v1/catalog/items/${itemId}/image`);
    this.itemImages.set(itemId, null);
    return result;
  }
  listCategories(query: CategoryQuery = {}) {
    return this.client.get<Page<Category>>(
      `/api/v1/catalog/categories?${buildQueryString({ limit: 50, offset: 0, ...query })}`,
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
    return this.client.get<Page<PriceHistoryEntry>>(
      `/api/v1/pricing/prices?catalogItemId=${itemId}&limit=100&offset=0`,
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
    return this.client.get<ResolvedPrice>(`/api/v1/pricing/resolve?${buildQueryString(input)}`);
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
  /** Runtime applies the amount to every active variant (or the listed ones) in one transaction. */
  changeVariantPrices(input: {
    catalogItemId: string;
    catalogVariantIds?: string[];
    currency: string;
    amount: string;
    effectiveFrom: string;
  }) {
    return this.client.post<{ items: VariantPriceChange[] }>(
      '/api/v1/pricing/prices/change-variants',
      input,
    );
  }
  cancelPrice(id: string) {
    return this.client.post<Price>(`/api/v1/pricing/prices/${id}/cancel`, {});
  }
}
