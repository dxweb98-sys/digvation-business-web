import { DBadge, DInput } from '@digvation/ui';
import { Check, ChevronRight, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { filterPromotionItemTargets } from './promotion-presentation';
import type { PromotionReferenceOption } from './promotions-api';

/**
 * Parent items with their variants. Selecting a parent includes every variant; otherwise
 * specific variants can be chosen. Search keeps the parent context of a matching variant.
 */
export function ItemVariantTargetSelector({
  items,
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
  const targetGroups = useMemo(
    () => filterPromotionItemTargets(items, variants, searchQuery),
    [items, searchQuery, variants],
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

  if (!items.length) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <DInput
        type="search"
        value={searchQuery}
        onChange={setSearchQuery}
        leftIcon={<Search className="size-4" />}
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        autoComplete="off"
        containerClassName="w-full"
      />

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        {targetGroups.length ? (
          targetGroups.map(({ item, variants: children }) => {
            const parentSelected = itemSet.has(item.id);
            const explicitVariantCount = variants.filter(
              (variant) => variant.catalogItemId === item.id && variantSet.has(variant.id),
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
                  <SelectionMark checked={parentSelected} />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-text)]">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        {item.code}
                      </span>
                    </div>
                    {parentSelected ? (
                      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
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
                    <ChevronRight
                      className="size-4 shrink-0 text-[var(--color-text-muted)]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>

                {children.length ? (
                  <div className="space-y-1 border-t border-[var(--color-border)] px-3 py-2 pl-8">
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
                            'flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                            effectiveSelected
                              ? 'border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.04]'
                              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]',
                            parentSelected ? 'cursor-default' : '',
                          ].join(' ')}
                        >
                          <SelectionMark checked={effectiveSelected} />

                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-text)]">
                            {variant.name}
                            <span className="ml-2 font-normal text-[var(--color-text-muted)]">
                              {variant.code}
                            </span>
                          </span>

                          {effectiveSelected ? (
                            <DBadge variant="success">
                              {parentSelected ? includedLabel : activeLabel}
                            </DBadge>
                          ) : (
                            <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                              {notIncludedLabel}
                            </span>
                          )}
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
            <p className="text-sm font-medium text-[var(--color-text)]">{noSearchResults}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">“{searchQuery.trim()}”</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TargetSelector({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  label: string;
  options: PromotionReferenceOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyLabel: string;
}) {
  const selectedSet = new Set(selected);
  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-[var(--color-text)]">{label}</legend>
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        {options.length ? (
          options.map((option) => {
            const active = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-[var(--color-brand)]/[.06] text-[var(--color-text)]'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]',
                ].join(' ')}
              >
                <SelectionMark checked={active} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{option.name}</span>
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">{option.code}</span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
        )}
      </div>
    </fieldset>
  );
}

function SelectionMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        'grid size-4 shrink-0 place-items-center rounded border',
        checked
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]',
      ].join(' ')}
    >
      {checked ? <Check className="size-3" /> : null}
    </span>
  );
}
