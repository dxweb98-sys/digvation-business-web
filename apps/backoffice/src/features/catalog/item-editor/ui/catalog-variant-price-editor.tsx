import { DBadge, DButton, DCurrencyInput, DInput } from '@digvation/ui';
import { Check, Layers, Plus, Trash2 } from 'lucide-react';
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

const tabular = 'md:[&_label]:sr-only';

export function VariantPriceEditor({
  drafts,
  onChange,
  currency,
  canPrice,
  canAddVariants,
  variantRequired = false,
  seed,
  showIssues,
}: {
  drafts: VariantPriceDraft[];
  onChange: (drafts: VariantPriceDraft[]) => void;
  currency: string;
  canPrice: boolean;
  canAddVariants: boolean;
  variantRequired?: boolean;
  seed?: { label: string; amount: string } | null;
  showIssues: boolean;
}) {
  const { formatMoney } = useCatalogLocalization();
  const [bulkPrice, setBulkPrice] = useState('');
  const update = (key: string, change: Partial<VariantPriceDraft>) =>
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)));
  const validBulk = isValidSellingPrice(bulkPrice);
  const priced = drafts.filter((draft) => isValidSellingPrice(draft.price)).length;

  if (!drafts.length) {
    return (
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-5 ${
          variantRequired && showIssues
            ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/[0.03]'
            : 'border-[var(--color-border)] bg-[var(--color-surface-muted)]/25'
        }`}
      >
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            {variantRequired ? 'Varian wajib belum ditambahkan.' : 'Belum ada varian tambahan.'}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              variantRequired && showIssues
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {variantRequired
              ? 'Tambahkan minimal satu varian dengan harga final.'
              : 'Opsi Default / Item utama tetap dapat dijual tanpa varian.'}
          </p>
        </div>
        {canAddVariants ? (
          <DButton
            variant="outline"
            size="sm"
            leftIcon={<Plus className="size-4" />}
            onClick={() => onChange([newVariantDraft()])}
          >
            Tambah varian
          </DButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canPrice ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 px-3 py-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2 sm:mr-auto">
            <Layers className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium text-[var(--color-text)]">
                Ubah Cepat Semua Harga
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Isi sekali lalu tetap bisa diedit per varian.
              </p>
            </div>
          </div>
          <DCurrencyInput
            aria-label="Harga untuk semua varian"
            value={bulkPrice}
            onValueChange={setBulkPrice}
            placeholder="Rp 0"
            containerClassName="sm:w-44"
          />
          <DButton
            variant="outline"
            size="sm"
            disabled={!validBulk}
            onClick={() => onChange(applyPriceToAllVariants(drafts, bulkPrice))}
          >
            Terapkan ke {drafts.length} varian
          </DButton>
          {seed && isValidSellingPrice(seed.amount) && !sameAmount(seed.amount, bulkPrice) ? (
            <DButton variant="link" size="sm" onClick={() => setBulkPrice(seed.amount.trim())}>
              {seed.label}
            </DButton>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]/35 px-3 py-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.03em] text-[var(--color-text)]">
              Daftar Varian Item
            </p>
            <DBadge variant="secondary">{drafts.length}</DBadge>
          </div>
          {canAddVariants ? (
            <DButton
              variant="link"
              size="sm"
              leftIcon={<Plus className="size-4" />}
              onClick={() => onChange([...drafts, newVariantDraft()])}
            >
              Tambah varian
            </DButton>
          ) : null}
        </div>

        <div
          className={`gap-3 border-b border-[var(--color-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)] max-md:hidden md:grid ${
            canPrice
              ? 'md:grid-cols-[1.3fr_1fr_1fr_2.25rem]'
              : 'md:grid-cols-[1.3fr_1fr_2.25rem]'
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
                className={`relative grid grid-cols-2 gap-3 px-3 py-2.5 md:items-start ${
                  canPrice
                    ? 'md:grid-cols-[1.3fr_1fr_1fr_2.25rem]'
                    : 'md:grid-cols-[1.3fr_1fr_2.25rem]'
                }`}
              >
                {persisted ? (
                  <>
                    <div className="min-w-0 md:pt-2">
                      <p className="truncate text-sm font-medium">{draft.name}</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] md:pt-2">
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
                      placeholder="Contoh: Red Burgundy"
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
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        {draft.priceUnknown ? (
                          'Harga tampil setelah item aktif.'
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

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-muted)]/25 px-3 py-2">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {canPrice
              ? priced === drafts.length
                ? `${drafts.length} varian aktif dengan harga final.`
                : `${drafts.length - priced} dari ${drafts.length} varian belum memiliki harga.`
              : `${drafts.length} varian.`}
          </p>
          {canPrice && priced === drafts.length ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-success)]">
              <Check className="size-3.5" aria-hidden="true" />
              Siap Dijual
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
