import { DBadge, DButton, DCurrencyInput, DInput } from '@digvation/ui';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';
import {
  applyPriceToAllVariants,
  isValidSellingPrice,
  newVariantDraft,
  sameAmount,
  variantDraftIssue,
  type VariantDraftIssue,
  type VariantPriceDraft,
} from '../model/variant-price-draft';

const issueMessage: Record<VariantDraftIssue, string> = {
  NAME_REQUIRED: 'Isi nama varian.',
  PRICE_REQUIRED: 'Isi harga varian.',
  PRICE_INVALID: 'Harga harus lebih dari nol, maksimal 4 angka desimal.',
};

/** Hides repeated field labels on wide screens, where the column header row labels them. */
const tabular = 'md:[&_label]:sr-only';

/**
 * Variant list with explicit per-variant prices for the Add and Edit item dialogs.
 * "Apply price to all variants" fills every row locally; each row stays editable.
 */
export function VariantPriceEditor({
  drafts,
  onChange,
  currency,
  canPrice,
  canAddVariants,
  seed,
  showIssues,
}: {
  drafts: VariantPriceDraft[];
  onChange: (drafts: VariantPriceDraft[]) => void;
  currency: string;
  canPrice: boolean;
  canAddVariants: boolean;
  /** Optional explicit shortcut that fills the bulk price, e.g. the price without a variant. */
  seed?: { label: string; amount: string } | null;
  showIssues: boolean;
}) {
  const { formatMoney } = useCatalogLocalization();
  const [bulkPrice, setBulkPrice] = useState('');
  const update = (key: string, change: Partial<VariantPriceDraft>) =>
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)));
  const validBulk = isValidSellingPrice(bulkPrice);
  const priced = drafts.filter((draft) => isValidSellingPrice(draft.price)).length;

  if (!drafts.length)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5">
        <p className="text-sm text-[var(--color-text-muted)]">
          Belum ada varian. Item dijual langsung dengan harga jual di atas.
        </p>
        {canAddVariants ? (
          <DButton
            variant="secondary"
            leftIcon={<Plus className="size-4" />}
            onClick={() => onChange([newVariantDraft()])}
          >
            Tambah varian
          </DButton>
        ) : null}
      </div>
    );

  return (
    <div className="space-y-3">
      {canPrice ? (
        <div className="rounded-xl bg-[var(--color-surface-muted)] p-3 sm:p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="size-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            Terapkan harga ke semua varian
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <DCurrencyInput
              aria-label="Harga untuk semua varian"
              value={bulkPrice}
              onValueChange={setBulkPrice}
              placeholder="Contoh: 28000"
              containerClassName="sm:max-w-56"
            />
            <DButton
              variant="outline"
              disabled={!validBulk}
              onClick={() => onChange(applyPriceToAllVariants(drafts, bulkPrice))}
            >
              Terapkan ke {drafts.length} varian
            </DButton>
            {seed && isValidSellingPrice(seed.amount) && !sameAmount(seed.amount, bulkPrice) ? (
              <DButton variant="link" onClick={() => setBulkPrice(seed.amount.trim())}>
                {seed.label} ({formatMoney(seed.amount.trim(), currency)})
              </DButton>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Setiap varian menyimpan harganya sendiri dan tetap bisa diubah satu per satu.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--color-border)]">
        <div
          className={`gap-3 border-b border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] max-md:hidden md:grid ${
            canPrice ? 'md:grid-cols-[1.3fr_1fr_1fr_2.25rem]' : 'md:grid-cols-[1.3fr_1fr_2.25rem]'
          }`}
        >
          <span>Nama varian</span>
          <span>SKU</span>
          {canPrice ? <span>Harga final ({currency})</span> : null}
          <span className="sr-only">Aksi</span>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {drafts.map((draft, index) => {
            const issue = showIssues ? variantDraftIssue(draft, canPrice) : null;
            const persisted = Boolean(draft.id);
            return (
              <li
                key={draft.key}
                className={`relative grid grid-cols-2 gap-3 px-4 py-3 md:items-start ${
                  canPrice
                    ? 'md:grid-cols-[1.3fr_1fr_1fr_2.25rem]'
                    : 'md:grid-cols-[1.3fr_1fr_2.25rem]'
                }`}
              >
                {persisted ? (
                  <>
                    <div className="min-w-0 md:pt-2">
                      <p className="truncate font-medium">{draft.name}</p>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] md:pt-2">
                      <span className="md:hidden">SKU </span>
                      {draft.code}
                    </p>
                  </>
                ) : (
                  <>
                    <DInput
                      label={`Nama varian ${index + 1}`}
                      value={draft.name}
                      onChange={(value) => update(draft.key, { name: value })}
                      placeholder="Contoh: Large / Iced"
                      error={issue === 'NAME_REQUIRED' ? issueMessage[issue] : undefined}
                      containerClassName={`${tabular} col-span-2 max-md:pr-10 md:col-span-1`}
                    />
                    <DInput
                      label="SKU"
                      value={draft.code}
                      onChange={(value) => update(draft.key, { code: value })}
                      placeholder="Otomatis"
                      containerClassName={tabular}
                    />
                  </>
                )}
                {canPrice ? (
                  <div className={`min-w-0 ${persisted ? 'col-span-2 md:col-span-1' : ''}`}>
                    <DCurrencyInput
                      label={`Harga ${draft.name.trim() || `varian ${index + 1}`}`}
                      value={draft.price}
                      onValueChange={(value) => update(draft.key, { price: value })}
                      placeholder="Wajib diisi"
                      error={
                        issue === 'PRICE_REQUIRED' || issue === 'PRICE_INVALID'
                          ? issueMessage[issue]
                          : undefined
                      }
                      containerClassName={tabular}
                    />
                    {persisted ? (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {draft.priceUnknown ? (
                          'Harga saat ini tampil setelah item aktif.'
                        ) : draft.persistedPrice === null ? (
                          <DBadge variant="warning">Belum ada harga varian</DBadge>
                        ) : sameAmount(draft.persistedPrice, draft.price) ? (
                          'Tidak berubah'
                        ) : (
                          `Saat ini ${formatMoney(draft.persistedPrice, currency)}`
                        )}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex justify-end max-md:absolute max-md:right-2 max-md:top-2.5 md:pt-0.5">
                  {persisted ? null : (
                    <DButton
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${draft.name.trim() || `varian ${index + 1}`}`}
                      onClick={() => onChange(drafts.filter((row) => row.key !== draft.key))}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </DButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
          <p className="text-xs text-[var(--color-text-muted)]">
            {canPrice
              ? priced === drafts.length
                ? `Semua ${drafts.length} varian memiliki harga final.`
                : `${drafts.length - priced} dari ${drafts.length} varian belum memiliki harga.`
              : `${drafts.length} varian.`}
          </p>
          {canAddVariants ? (
            <DButton
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="size-4" />}
              onClick={() => onChange([...drafts, newVariantDraft()])}
            >
              Tambah varian
            </DButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
