import { ChevronRight, Clock, Plus } from 'lucide-react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { CatalogItem } from '../transaction/model/cashier-transaction.types';
import { money, formatDurationMinutes } from '../transaction/model/sale-display';

/** Initials that stand in for an item photo, e.g. "Hair Spa" -> "HS", "Manicure" -> "Ma". */
function itemMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  const word = words[0] ?? '';
  return `${word.charAt(0).toUpperCase()}${word.charAt(1).toLowerCase()}`;
}

/**
 * The card's media band: the item photo edge to edge, or its initials on a
 * soft tint filling the same band, so every card keeps one height and one
 * rhythm whether or not a photo exists.
 */
function CatalogItemMedia({ item }: { item: CatalogItem }) {
  const isService = item.type === 'SERVICE';
  const imageUrl = item.image?.url;
  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-[4/3] w-full overflow-hidden border-b sm:aspect-[3/2] border-[var(--color-border)] ${
        imageUrl
          ? 'bg-[var(--color-surface-muted)]'
          : isService
            ? 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-brand)_14%,var(--color-surface))_0%,color-mix(in_srgb,var(--color-brand)_5%,var(--color-surface))_100%)] text-[var(--color-brand)]'
            : 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent-mint)_70%,var(--color-surface))_0%,color-mix(in_srgb,var(--color-accent-mint)_30%,var(--color-surface))_100%)] text-[var(--color-text)]'
      }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-[var(--color-surface)]/70 text-lg font-semibold tracking-wide shadow-sm ring-1 ring-inset ring-current/10 sm:size-16 sm:text-xl">
            {itemMonogram(item.name)}
          </span>
        </span>
      )}
    </span>
  );
}

export function ReferenceCatalogCard({
  item,
  price,
  locale,
  disabled,
  onAdd,
}: {
  item: CatalogItem;
  price: string | null;
  locale: string;
  disabled: boolean;
  onAdd: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const displayPrice = item.displayPrice;
  const variantCount = item.variants?.length ?? 0;
  const needsVariantChoice = variantCount > 0;
  const choiceLabel = item.variantSelectionMode === 'OPTIONAL' ? 'Choose option' : 'Choose variant';
  const duration = formatDurationMinutes(item.serviceDefinition?.defaultDurationMinutes, locale);
  return (
    <button
      type="button"
      aria-label={`${copy(needsVariantChoice ? choiceLabel : 'Add')} ${item.name}`}
      disabled={disabled}
      onClick={onAdd}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-all hover:border-[var(--color-brand)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/40 active:scale-[.98] disabled:opacity-50"
    >
      <CatalogItemMedia item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-3 p-3">
        {/* Identity: a quiet reference line (code, plus duration when the item has one) over the name. */}
        <span className="block min-w-0">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[var(--color-text-muted)]">
            <span className="truncate font-mono tracking-tight">{item.code}</span>
            {duration ? (
              <span className="flex shrink-0 items-center gap-1">
                <span aria-hidden="true">·</span>
                <Clock className="size-3" aria-hidden="true" />
                {duration}
              </span>
            ) : null}
          </span>
          <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-[var(--color-text)]">
            {item.name}
          </span>
        </span>
        {/* Commerce: price and action stay anchored to the bottom, so they line up across a grid row. */}
        <span className="mt-auto block border-t border-[var(--color-border)]/70 pt-2.5">
          {price ? (
            <span className="flex items-baseline gap-1 tabular-nums">
              {displayPrice?.kind === 'FROM' ? (
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                  {copy('From')}
                </span>
              ) : null}
              <span className="text-sm font-bold text-[var(--color-text)]">
                {money(price, locale)}
              </span>
            </span>
          ) : (
            <span className="block text-[11px] leading-5 text-[var(--color-text-muted)]">
              {copy('Price available when selected')}
            </span>
          )}
          {/* Both outcomes share one treatment; the wording and icon say whether a picker opens first. */}
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold leading-4 text-[var(--color-brand)]">
            {needsVariantChoice ? (
              <>
                {copy(choiceLabel)}
                <ChevronRight
                  className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </>
            ) : (
              <>
                <Plus
                  className="size-3.5 shrink-0 transition-transform group-hover:rotate-90 motion-reduce:transition-none"
                  aria-hidden="true"
                />
                {copy('Add')}
              </>
            )}
          </span>
        </span>
      </span>
    </button>
  );
}
