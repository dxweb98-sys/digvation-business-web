import type { CatalogItem } from './cashier-transaction.types';

/**
 * Items the cashier can put on a Sale on their own. COMPONENT_ONLY Products exist only as Service
 * composition components: Runtime never projects them for selling, and this keeps a management
 * fallback list from offering them either. Services that use them stay selectable.
 */
export function isStandaloneSellable(item: Pick<CatalogItem, 'lifecycle' | 'productUsage'>) {
  return item.lifecycle === 'ACTIVE' && item.productUsage !== 'COMPONENT_ONLY';
}
