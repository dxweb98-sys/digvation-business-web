import { DBadge, DInput } from '@digvation/ui';
import { Check, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { PromotionReferenceOption } from '../../../entities/promotion';
import { filterPromotionItemTargets } from '../model/promotion-presentation';

export function ItemVariantTargetSelector({
  items,
  searchItems,
  variants,
  itemIds,
  variantIds,
  onItemsChange,
  onVariantsChange,
  emptyLabel,
  specificLabel,
  includedLabel,
  notIncludedLabel,
  parentIncludesVariantsLabel,
  activeLabel,
  searchLabel,
  searchPlaceholder,
  noSearchResults,
}: {
  items: PromotionReferenceOption[];
  searchItems: PromotionReferenceOption[];
  variants: PromotionReferenceOption[];
  itemIds: string[];
  variantIds: string[];
  onItemsChange: (ids: string[]) => void;
  onVariantsChange: (ids: string[]) => void;
  emptyLabel: string;
  specificLabel: string;
  includedLabel: string;
  notIncludedLabel: string;
  parentIncludesVariantsLabel: string;
  activeLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  noSearchResults: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const itemSet = new Set(itemIds);
  const variantSet = new Set(variantIds);
  const searchActive = searchQuery.trim().length > 0;
  const targetGroups = useMemo(
    () =>
      filterPromotionItemTargets(
        searchActive ? searchItems : items,
        variants,
        searchQuery,
      ),
    [items, searchActive, searchItems, searchQuery, variants],
  );

  const toggleParent = (itemId: string) => {
    onItemsChange(
      itemSet.has(itemId) ? itemIds.filter((id) => id !== itemId) : [...itemIds, itemId],
    );
  };

  const toggleVariant = (variantId: string, parentSelected: boolean) => {
    if (parentSelected) return;
    onVariantsChange(
      variantSet.has(variantId)
        ? variantIds.filter((id) => id !== variantId)
        : [...variantIds, variantId],
    );
  };

  if (!searchItems.length) {
    return (
      <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DInput
        size="sm"
        type="search"
        value={searchQuery}
        onChange={setSearchQuery}
        leftIcon={<Search className="size-3.5" />}
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        autoComplete="off"
        containerClassName="w-full"
      />

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
        {targetGroups.length ? (
          targetGroups.map(({ item, variants: children }) => {
            const parentSelected = itemSet.has(item.id);
            const allChildren = variants.filter((variant) => variant.catalogItemId === item.id);
            const explicitVariantCount = allChildren.filter((variant) =>
              variantSet.has(variant.id),
            ).length;
            const groupActive = parentSelected || explicitVariantCount > 0;

        return (
          <div
            key={item.id}
            className={[
              'rounded-lg border',
              groupActive
                ? 'border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[.025]'
                : 'border-[var(--color-border)]',
            ].join(' ')}
          >
            <button
              type="button"
              aria-pressed={parentSelected}
              onClick={() => toggleParent(item.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <span
                className={[
                  'grid size-4 shrink-0 place-items-center rounded border',
                  parentSelected
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]',
                ].join(' ')}
              >
                {parentSelected ? <Check className="size-3" /> : null}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold">{item.name}</span>
                  <span className="shrink-0 text-[9px] text-[var(--color-text-muted)]">
                    {item.code}
                  </span>
                </div>
                {parentSelected ? (
                  <p className="mt-0.5 text-[9px] text-[var(--color-text-muted)]">
                    {parentIncludesVariantsLabel}
                  </p>
                ) : null}
              </div>

              {explicitVariantCount > 0 ? (
                <DBadge variant="secondary">
                  {explicitVariantCount} {specificLabel}
                </DBadge>
              ) : null}
              {children.length ? (
                <ChevronRight className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
              ) : null}
            </button>

            {children.length ? (
              <div className="space-y-1 border-t border-[var(--color-border)] px-3 py-2 pl-7">
                {children.map((variant) => {
                  const explicitlySelected = variantSet.has(variant.id);
                  const effectiveSelected = parentSelected || explicitlySelected;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={effectiveSelected}
                      onClick={() => toggleVariant(variant.id, parentSelected)}
                      className={[
                        'flex w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-left transition-colors',
                        effectiveSelected
                          ? 'border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.04]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]',
                        parentSelected ? 'cursor-default' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'grid size-4 shrink-0 place-items-center rounded border',
                          effectiveSelected
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                            : 'border-[var(--color-border)]',
                        ].join(' ')}
                      >
                        {effectiveSelected ? <Check className="size-3" /> : null}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                        {variant.name}
                        <span className="ml-2 text-[9px] font-normal text-[var(--color-text-muted)]">
                          {variant.code}
                        </span>
                      </span>

                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold',
                          effectiveSelected
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'text-slate-400',
                        ].join(' ')}
                      >
                        {parentSelected
                          ? includedLabel
                          : explicitlySelected
                            ? activeLabel
                            : notIncludedLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
          })
        ) : (
          <div className="px-3 py-6 text-center">
            <p className="text-xs font-medium text-[var(--color-text)]">{noSearchResults}</p>
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              “{searchQuery.trim()}”
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
