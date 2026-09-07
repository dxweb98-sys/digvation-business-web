import { formatMoney } from '@digvation/pos-money';
import { DButton, DInput, DSkeleton } from '@digvation/ui';
import { PackageSearch, Search, ShoppingBag, Wrench } from 'lucide-react';

import type { CatalogItem, ResolvedPrice } from '../cashier-transaction.types';
import type { ActionAvailability } from '../sale-workspace-view-model';
import type { CatalogItemTypeFilter } from '../use-selling-catalog';

interface SellingCatalogPaneProps {
  items: readonly CatalogItem[];
  priceByItemId: ReadonlyMap<string, ResolvedPrice>;
  locale: string;
  search: string;
  itemType: CatalogItemTypeFilter;
  isLoading: boolean;
  availability: ActionAvailability;
  hasBranch: boolean;
  onSearchChange: (search: string) => void;
  onItemTypeChange: (itemType: CatalogItemTypeFilter) => void;
  onChooseBranch: () => void;
  onSelectItem: (item: CatalogItem) => void;
}

export function SellingCatalogPane({
  items,
  priceByItemId,
  locale,
  search,
  itemType,
  isLoading,
  availability,
  hasBranch,
  onSearchChange,
  onItemTypeChange,
  onChooseBranch,
  onSelectItem,
}: SellingCatalogPaneProps) {
  const isMutationDisabled = availability.state !== 'AVAILABLE' || !hasBranch;

  return (
    <section className="flex min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-[var(--shadow-panel)] lg:flex-row lg:items-center">
        <div className="inline-flex h-9 shrink-0 items-center gap-2 px-2 text-xs font-bold text-[var(--color-brand)]">
          <ShoppingBag className="size-3.5" /> Catalog
        </div>
        <div
          className="inline-flex h-9 shrink-0 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1"
          role="group"
          aria-label="Item type"
        >
          {(['ALL', 'PRODUCT', 'SERVICE'] as const).map((type) => (
            <DButton
              variant="ghost"
              key={type}
              type="button"
              onClick={() => onItemTypeChange(type)}
              aria-pressed={itemType === type}
              className={`h-7 rounded-md px-3 text-xs font-semibold transition-colors ${
                itemType === type
                  ? 'bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm ring-1 ring-[var(--color-border)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {type === 'ALL' ? 'All' : `${type.slice(0, 1)}${type.slice(1).toLocaleLowerCase()}`}
            </DButton>
          ))}
        </div>
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search catalog</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <DInput
            value={search}
            onChange={onSearchChange}
            placeholder="Search items"
            className="h-9 bg-[var(--color-background)] pl-9 pr-3 text-xs"
          />
        </label>
      </div>

      {!hasBranch ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-center">
          <PackageSearch className="size-7 text-[var(--color-text-muted)]" />
          <p className="mt-3 text-sm font-bold">Choose a branch to begin</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--color-text-muted)]">
            Select the active branch from the workspace controls before adding items to a Sale.
          </p>
          <DButton variant="secondary" className="mt-4" onClick={onChooseBranch}>
            Choose branch
          </DButton>
        </div>
      ) : null}

      {hasBranch ? (
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 6 }, (item, index) => (
              <div
                key={index}
                className="aspect-[.88] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <DSkeleton className="aspect-square w-full" />
                <DSkeleton className="mt-3 h-3 w-1/2" />
                <DSkeleton className="mt-2 h-4 w-3/4" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="col-span-full rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 text-center">
              <PackageSearch className="mx-auto size-6 text-[var(--color-text-muted)]" />
              <p className="mt-3 text-sm font-bold">No matching active items</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Try another search or item type.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const price = priceByItemId.get(item.id);

              return (
                <DButton
                  variant="ghost"
                  key={item.id}
                  type="button"
                  aria-label={`Add ${item.name}`}
                  disabled={isMutationDisabled}
                  onClick={() => onSelectItem(item)}
                  className="group flex h-auto min-h-0 w-full aspect-[.88] min-w-0 flex-col items-stretch justify-start rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-panel)] transition-[transform,box-shadow,border-color] duration-150 hover:border-[var(--color-brand)]/40 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div
                    className={`grid aspect-square w-full place-items-center rounded-xl ${
                      item.type === 'SERVICE'
                        ? 'bg-[var(--color-accent-lavender)]/45 text-[var(--color-brand)]'
                        : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                    }`}
                  >
                    {item.type === 'SERVICE' ? (
                      <Wrench className="size-7" />
                    ) : (
                      <ShoppingBag className="size-7" />
                    )}
                  </div>
                  <span className="mt-2 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                    {item.code}
                  </span>
                  <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold leading-5">
                    {item.name}
                  </h3>
                  <p className="mt-auto pt-2 text-sm font-bold text-[var(--color-brand)] tabular-nums">
                    {price
                      ? formatMoney(price.amount, price.currency, locale)
                      : 'Price unavailable'}
                  </p>
                </DButton>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
