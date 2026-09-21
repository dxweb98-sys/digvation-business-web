export type CatalogItemType = 'PRODUCT' | 'SERVICE';

export type CatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export type CatalogRecordStatus = 'ACTIVE' | 'INACTIVE';

export type VariantSelectionMode = 'REQUIRED' | 'OPTIONAL';

export interface CatalogServiceDefinition {
  defaultDurationMinutes: number | null;
}

export interface CatalogNamedRecord {
  id: string;
  code: string;
  name: string;
  status: CatalogRecordStatus;
  version: number;
}

export type CatalogCategory = CatalogNamedRecord;

export interface CatalogVariant extends CatalogNamedRecord {
  catalogItemId: string;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  type: CatalogItemType;
  categoryId: string | null;
  description: string | null;
  lifecycle: CatalogLifecycle;
  fulfillmentBehavior: 'INSTANT' | 'TRACKED';
  /**
   * Runtime-owned selling configuration.
   *
   * REQUIRED means an active variant must be selected.
   * OPTIONAL allows the parent item to remain directly sellable alongside variants.
   */
  variantSelectionMode: VariantSelectionMode;
  version: number;
  serviceDefinition: CatalogServiceDefinition | null;
}
