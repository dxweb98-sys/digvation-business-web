import { CatalogSection } from '../../ui/catalog-shared';
import {
  sellingModelCopy,
  sellsItemItself,
  type SellingModel,
} from '../../model/catalog-selling';
import { isValidSellingPrice } from '../model/variant-price-draft';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemSaveSummarySection({
  editor,
  model,
  currency,
  formatMoney,
}: {
  editor: CatalogItemEditor;
  model: SellingModel;
  currency: string;
  formatMoney: (amount: string, currency: string) => string;
}) {
  const { variants, defaultPrice } = editor.form;

  return (
    <CatalogSection
      title="Akan disimpan"
      tone="secondary"
      description={sellingModelCopy[model].description}
    >
      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {sellsItemItself(model) ? (
          <div className="flex justify-between gap-3 border-b border-(--color-border) pb-2 sm:col-span-2">
            <dt className="text-(--color-text-muted)">Tanpa varian</dt>
            <dd
              className={`font-medium tabular-nums ${
                isValidSellingPrice(defaultPrice) ? '' : 'text-(--color-danger)'
              }`}
            >
              {isValidSellingPrice(defaultPrice)
                ? formatMoney(defaultPrice.trim(), currency)
                : 'Belum ada harga'}
            </dd>
          </div>
        ) : null}

        {variants.map((draft, index) => (
          <div key={draft.key} className="flex justify-between gap-3">
            <dt className="truncate text-(--color-text-muted)">
              {draft.name.trim() || `Varian ${index + 1}`}
            </dt>
            <dd
              className={`font-medium tabular-nums ${
                isValidSellingPrice(draft.price) ? '' : 'text-(--color-danger)'
              }`}
            >
              {isValidSellingPrice(draft.price)
                ? formatMoney(draft.price.trim(), currency)
                : 'Belum ada harga'}
            </dd>
          </div>
        ))}
      </dl>
    </CatalogSection>
  );
}
