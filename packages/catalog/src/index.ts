export type {
  CatalogCategory,
  CatalogItem,
  CatalogItemType,
  CatalogLifecycle,
  CatalogNamedRecord,
  CatalogRecordStatus,
  CatalogServiceDefinition,
  CatalogVariant,
  VariantSelectionMode,
} from './catalog.types';

export {
  catalogItemSellsDirectly,
  resolveCatalogSellingModel,
  type CatalogSellingModel,
} from './selling-model';
