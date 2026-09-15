import { formatMoney } from '@digvation/pos-money';
import { DButton, DDialog } from '@digvation-labs/ui';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

import type { CatalogItem, CatalogVariant } from '../cashier-transaction.types';

export type VariantPickerContext = 'CART' | 'TRANSACTION_ADJUSTMENT';

export interface VariantPickerState {
  item: CatalogItem;
  variants: readonly CatalogVariant[];
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

export function VariantPicker({
  item,
  variants,
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
            {isAdjustment
              ? 'Pilih satu varian untuk ditambahkan ke transaksi.'
              : 'Pilih satu varian untuk ditambahkan ke cart.'}
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

      <div className="mt-4 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
        {variants.map((variant) => {
          const price = pricesByVariantId[variant.id];
          const isUnavailable = unavailableVariantIds.includes(variant.id);
          const selected = selectedVariantId === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              disabled={isUnavailable}
              onClick={() => setSelectedVariantId(variant.id)}
              aria-pressed={selected}
              className={`flex min-h-14 w-full items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'bg-[var(--color-brand)]/7 shadow-[inset_2px_0_0_var(--color-brand)]' : 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]/60'}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{variant.name}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--color-text-muted)]">
                  {variant.code}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {isUnavailable ? (
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                    Harga belum tersedia
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
          Batal
        </DButton>
        <DButton
          type="button"
          disabled={selectedVariantId === null}
          onClick={() => {
            if (selectedVariantId) onSelect(selectedVariantId);
          }}
        >
          {isAdjustment ? 'Tambahkan ke Transaksi' : 'Tambahkan ke Cart'}
        </DButton>
      </div>
    </DDialog>
  );
}
