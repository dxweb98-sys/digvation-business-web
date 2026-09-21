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
    <section
      aria-label="Akan disimpan"
      className="mt-5 border-t border-[var(--color-border)] pt-4"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text)]">
          Akan disimpan
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {sellingModelCopy[model].description}
        </p>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-[var(--color-surface-muted)]/35 p-3 text-sm sm:grid-cols-2">
        {sellsItemItself(model) ? (
          <div className="flex justify-between gap-3 border-b border-[var(--color-border)] pb-2 sm:col-span-2">
            <dt className="text-[var(--color-text-muted)]">Default / Item utama</dt>
            <dd
              className={`font-medium tabular-nums ${
                isValidSellingPrice(defaultPrice) ? '' : 'text-[var(--color-danger)]'
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
            <dt className="truncate text-[var(--color-text-muted)]">
              {draft.name.trim() || `Varian ${index + 1}`}
            </dt>
            <dd
              className={`font-medium tabular-nums ${
                isValidSellingPrice(draft.price) ? '' : 'text-[var(--color-danger)]'
              }`}
            >
              {isValidSellingPrice(draft.price)
                ? formatMoney(draft.price.trim(), currency)
                : 'Belum ada harga'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
