import { formatMoney } from '@digvation/pos-money';
import { DButton, DDialog } from '@digvation-labs/ui';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../../../app/localization/operational-localization';

const copyFor = (locale: string, value: string) =>
  operationalCopy(value, resolveOperationalLocale(locale));
import type { CatalogItem, CatalogVariant } from '../cashier-transaction.types';

export type VariantPickerContext = 'CART' | 'TRANSACTION_ADJUSTMENT';

export interface VariantPickerState {
  item: CatalogItem;
  variants: readonly CatalogVariant[];
  /**
   * Present only when the item itself is also sold without a variant; `price` is its own price,
   * or null when no current price is available. Absent for items that require a variant.
   */
  itemOption?: { price: string | null } | null;
  pricesByVariantId?: Readonly<Record<string, string>>;
  unavailableVariantIds?: readonly string[];
  locale?: string;
  currency?: string;
  context?: VariantPickerContext;
  targetSaleId?: string;
}

interface VariantPickerProps extends VariantPickerState {
  onSelect: (catalogVariantId: string | null) => void;
  onClose: () => void;
}

/** Picker-local choice for "the item itself"; never sent anywhere (it becomes no variant). */
const ITEM_OPTION = 'item-option';

export function VariantPicker({
  item,
  variants,
  itemOption = null,
  pricesByVariantId = {},
  unavailableVariantIds = [],
  locale = 'id-ID',
  currency = 'IDR',
  context = 'CART',
  onSelect,
  onClose,
}: VariantPickerProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const isAdjustment = context === 'TRANSACTION_ADJUSTMENT';
  const choices = [
    ...(itemOption
      ? [
          {
            id: ITEM_OPTION,
            name: copyFor(locale, 'Without variant'),
            detail: copyFor(locale, 'Sold as the item itself'),
            price: itemOption.price ?? undefined,
            unavailable: itemOption.price === null,
          },
        ]
      : []),
    ...variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      detail: variant.code,
      price: pricesByVariantId[variant.id],
      unavailable: unavailableVariantIds.includes(variant.id),
    })),
  ];
  const operationalLocale = resolveOperationalLocale(locale);
  const copy = (value: string) => operationalCopy(value, operationalLocale);

  return (
    <DDialog
      open
      onClose={onClose}
      ariaLabelledBy="variant-picker-title"
      closeOnEscape
      closeOnOverlay
      showClose={false}
      noPadding
      overlayClassName="grid place-items-end bg-slate-950/25 backdrop-blur-[2px] sm:place-items-center sm:p-6"
      className="animate-[pos-dialog-in_170ms_ease-out] w-full rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
            {copy(itemOption ? 'Select option' : 'Select variant')}
          </p>
          <h2 id="variant-picker-title" className="mt-1 text-lg font-bold">
            {item.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy(
              itemOption
                ? isAdjustment
                  ? 'Select one option to add to the transaction.'
                  : 'Select one option to add to the cart.'
                : isAdjustment
                  ? 'Select one variant to add to the transaction.'
                  : 'Select one variant to add to the cart.',
            )}
          </p>
        </div>
        <DButton
          variant="ghost"
          type="button"
          aria-label={copy('Close')}
          onClick={onClose}
          className="grid size-9 place-items-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
        >
          <X className="size-4" />
        </DButton>
      </div>

      <div className="mt-4 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
        {choices.map((choice) => {
          const price = choice.price;
          const isUnavailable = choice.unavailable;
          const selected = selectedVariantId === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={isUnavailable}
              onClick={() => setSelectedVariantId(choice.id)}
              aria-pressed={selected}
              className={`flex min-h-14 w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'bg-[var(--color-brand)]/7 shadow-[inset_2px_0_0_var(--color-brand)]' : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/60'}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{choice.name}</span>
                <span
                  className={`mt-0.5 block text-[10px] text-[var(--color-text-muted)] ${choice.id === ITEM_OPTION ? '' : 'font-mono'}`}
                >
                  {choice.detail}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {isUnavailable ? (
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {copy('Price unavailable')}
                  </span>
                ) : price ? (
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {formatMoney(price, currency, locale, 0)}
                  </span>
                ) : null}
                <span
                  className={`grid size-4 place-items-center rounded-full border transition-colors ${selected ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-background)] text-transparent'}`}
                  aria-hidden="true"
                >
                  <Check className="size-2.5" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
        <DButton variant="ghost" type="button" onClick={onClose}>
          {copy('Cancel')}
        </DButton>
        <DButton
          type="button"
          disabled={selectedVariantId === null}
          onClick={() => {
            if (selectedVariantId)
              onSelect(selectedVariantId === ITEM_OPTION ? null : selectedVariantId);
          }}
        >
          {copy(isAdjustment ? 'Add to transaction' : 'Add to cart')}
        </DButton>
      </div>
    </DDialog>
  );
}
