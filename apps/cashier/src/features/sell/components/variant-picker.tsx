import { formatMoney } from '@digvation/pos-money';
import { DButton, DDialog } from '@digvation/ui';
import { Check, ChevronRight, X } from 'lucide-react';

import type { CatalogItem, CatalogVariant } from '../cashier-transaction.types';

export interface VariantPickerState {
  item: CatalogItem;
  variants: readonly CatalogVariant[];
  pricesByVariantId?: Readonly<Record<string, string>>;
  locale?: string;
  currency?: string;
}

interface VariantPickerProps extends VariantPickerState {
  onSelect: (catalogVariantId: string | null) => void;
  onClose: () => void;
}

export function VariantPicker({
  item,
  variants,
  pricesByVariantId = {},
  locale = 'id-ID',
  currency = 'IDR',
  onSelect,
  onClose,
}: VariantPickerProps) {
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
            Pilih varian
          </p>
          <h2 id="variant-picker-title" className="mt-1 text-lg font-bold">
            {item.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Pilih satu varian untuk dimasukkan ke cart.
          </p>
        </div>
        <DButton
          variant="ghost"
          type="button"
          aria-label="Close variant picker"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)]"
        >
          <X className="size-4" />
        </DButton>
      </div>

      <div className="mt-4 grid gap-1.5">
        {variants.map((variant) => {
          const price = pricesByVariantId[variant.id];
          return (
            <DButton
              variant="ghost"
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              className="group flex min-h-14 items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-left transition-all hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand)]/5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                  <Check className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{variant.name}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-[var(--color-text-muted)]">
                    {variant.code}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {price ? (
                  <span className="text-sm font-bold text-[var(--color-brand)]">
                    {formatMoney(price, currency, locale, 0)}
                  </span>
                ) : null}
                <ChevronRight className="size-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
              </span>
            </DButton>
          );
        })}
      </div>
    </DDialog>
  );
}
