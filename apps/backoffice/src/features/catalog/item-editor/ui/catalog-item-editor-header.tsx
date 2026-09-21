import type { CatalogApi, Item } from '../../api/catalog-api';
import { sellingModel } from '../../model/catalog-selling';
import { SellingModelBadge } from '../../ui/catalog-selling';
import { Status } from '../../ui/catalog-shared';
import { CatalogItemThumbnail } from '../../ui/catalog-item-thumbnail';

export function CatalogItemEditorHeader({
  item,
  api,
  hasVariants,
  canViewPricing,
  variantPricesLoading,
}: {
  item: Item;
  api: CatalogApi;
  hasVariants: boolean;
  canViewPricing: boolean;
  variantPricesLoading: boolean;
}) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl bg-(--color-surface-muted) px-3 py-2.5">
      <CatalogItemThumbnail api={api} itemId={item.id} itemName={item.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{item.name}</p>
        <p className="truncate text-xs text-(--color-text-muted)">
          {item.code} · {item.type === 'SERVICE' ? 'Jasa' : 'Produk'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {canViewPricing && !variantPricesLoading ? (
          <SellingModelBadge model={sellingModel(hasVariants, item.variantSelectionMode)} />
        ) : null}
        <Status value={item.lifecycle} />
      </div>
    </div>
  );
}
