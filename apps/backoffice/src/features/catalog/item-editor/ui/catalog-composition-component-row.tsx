import { DButton, DCheckbox, DCombobox, DCurrencyInput, DDecimalInput, DRadio, DSelect } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { CatalogApi } from '../../api/catalog-api';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';
import type { ComponentProductInfo } from '../api/use-service-composition';
import {
  componentContribution,
  componentDraftIssue,
  type ComponentDraftIssue,
  type CompositionComponentDraft,
} from '../model/service-composition-draft';

const issueMessage: Record<ComponentDraftIssue, string> = {
  PRODUCT_REQUIRED: 'Pilih produk.',
  VARIANT_REQUIRED: 'Pilih variant produk.',
  QUANTITY_INVALID: 'Jumlah harus lebih dari nol, maksimal 4 angka desimal.',
  FIXED_PRICE_INVALID: 'Isi harga khusus per unit.',
  DUPLICATE: 'Produk dan variant yang sama sudah ada di komponen ini.',
};

const COMPONENT_ONLY_LABEL = 'Khusus Komponen';

export function CompositionComponentRow({
  component,
  info,
  duplicateKeys,
  showIssues,
  disabled,
  api,
  currency,
  effectiveAt,
  onChange,
  onRemove,
}: {
  component: CompositionComponentDraft;
  info: ComponentProductInfo | undefined;
  duplicateKeys: ReadonlySet<string>;
  showIssues: boolean;
  disabled: boolean;
  api: CatalogApi;
  currency: string;
  effectiveAt: string;
  onChange: (change: Partial<CompositionComponentDraft>) => void;
  onRemove: () => void;
}) {
  const { formatMoney } = useCatalogLocalization();
  const [search, setSearch] = useState('');
  const requirement = info?.requirement ?? 'NONE';
  const issue = componentDraftIssue(component, requirement, duplicateKeys);
  const visibleIssue = issue && (showIssues || issue === 'DUPLICATE') ? issueMessage[issue] : undefined;
  const following = component.addsPrice && component.priceSource === 'FOLLOW_PRODUCT_PRICE';
  const fixed = component.addsPrice && component.priceSource === 'FIXED_COMPONENT_PRICE';

  const products = useQuery({
    queryKey: ['catalog', 'composition-product-search', search.trim()],
    queryFn: () =>
      api.listItems({
        type: 'PRODUCT',
        lifecycle: 'ACTIVE',
        limit: 20,
        offset: 0,
        ...(search.trim() ? { q: search.trim() } : {}),
      }),
    staleTime: 15_000,
  });

  const productOptions = useMemo(() => {
    const found = new Map<string, { label: string; usage: string }>();
    for (const product of products.data?.items ?? []) {
      found.set(product.id, {
        label: product.name,
        usage: product.productUsage,
      });
    }
    if (component.productId && !found.has(component.productId))
      found.set(component.productId, {
        label: component.productLabel,
        usage: component.productUsage ?? 'STANDALONE_AND_COMPONENT',
      });
    return [...found].map(([value, product]) => ({
      value,
      label:
        product.usage === 'COMPONENT_ONLY'
          ? `${product.label} · ${COMPONENT_ONLY_LABEL}`
          : product.label,
    }));
  }, [component.productId, component.productLabel, component.productUsage, products.data]);

  const referenceReady =
    following && Boolean(component.productId) && (requirement !== 'REQUIRED' || Boolean(component.productVariantId));
  const referencePrice = useQuery({
    queryKey: [
      'catalog',
      'composition-reference-price',
      component.productId,
      component.productVariantId,
      currency,
      effectiveAt,
    ],
    queryFn: () =>
      api.resolvePrice({
        catalogItemId: component.productId!,
        catalogVariantId: component.productVariantId,
        currency,
        effectiveAt,
      }),
    enabled: referenceReady,
    retry: false,
  });
  const unitAmount = following
    ? (referencePrice.data?.amount ?? null)
    : fixed
      ? component.fixedPrice.trim() || null
      : null;
  const contribution = unitAmount ? componentContribution(component.quantity, unitAmount) : null;

  const variantOptions = (info?.variants ?? []).map((variant) => ({
    value: variant.id,
    label: variant.name,
  }));

  return (
    <li className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_auto] md:items-start">
        <DCombobox
          label="Produk"
          ariaLabel="Produk komponen"
          placeholder="Cari produk"
          options={productOptions}
          value={component.productId}
          loading={products.isFetching}
          disabled={disabled}
          onSearchChange={setSearch}
          error={!component.productId ? visibleIssue : undefined}
          onChange={(value) => {
            const id = value === null ? null : String(value);
            const chosen = products.data?.items.find((product) => product.id === id);
            onChange({
              productId: id,
              productLabel: chosen?.name ?? '',
              productUsage: chosen?.productUsage ?? null,
              productVariantId: null,
            });
          }}
        />

        {variantOptions.length ? (
          <DSelect
            label="Variant"
            value={component.productVariantId}
            options={variantOptions}
            placeholder={requirement === 'REQUIRED' ? 'Pilih variant' : 'Produk utama'}
            clearable={requirement !== 'REQUIRED'}
            disabled={disabled}
            error={issue === 'VARIANT_REQUIRED' ? visibleIssue : undefined}
            onChange={(value) =>
              onChange({ productVariantId: value === null ? null : String(value) })
            }
          />
        ) : (
          <div aria-hidden="true" />
        )}

        <DDecimalInput
          label="Jumlah"
          value={component.quantity}
          scale={4}
          disabled={disabled}
          onValueChange={(quantity) => onChange({ quantity })}
          error={issue === 'QUANTITY_INVALID' ? visibleIssue : undefined}
        />

        <DButton
          variant="ghost"
          size="sm"
          aria-label="Hapus komponen"
          className="md:mt-6"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </DButton>
      </div>

      {issue === 'DUPLICATE' && visibleIssue ? (
        <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
          {visibleIssue}
        </p>
      ) : null}

      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
        <label className="flex items-start gap-3">
          <DCheckbox
            checked={component.addsPrice}
            disabled={disabled}
            onChange={() => onChange({ addsPrice: !component.addsPrice })}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--color-text)]">
              Tambahkan harga komponen ke harga jasa
            </span>
            {!component.addsPrice ? (
              <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                Komponen sudah termasuk dalam harga jasa.
              </span>
            ) : null}
          </span>
        </label>

        {component.addsPrice ? (
          <div className="mt-3 space-y-3 pl-7">
            <fieldset disabled={disabled} className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
                Sumber harga
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <DRadio
                  name={`price-source-${component.key}`}
                  checked={following}
                  onChange={() => onChange({ priceSource: 'FOLLOW_PRODUCT_PRICE' })}
                />
                Ikuti harga produk
              </label>
              <label className="flex items-center gap-2 text-sm">
                <DRadio
                  name={`price-source-${component.key}`}
                  checked={fixed}
                  onChange={() => onChange({ priceSource: 'FIXED_COMPONENT_PRICE' })}
                />
                Harga khusus
              </label>
            </fieldset>

            {following ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Harga produk saat ini</dt>
                  <dd data-testid="component-reference-price" className="font-medium">
                    {referencePrice.data
                      ? formatMoney(referencePrice.data.amount, currency)
                      : referencePrice.isError
                        ? 'Belum ada harga'
                        : referenceReady
                          ? 'Memuat...'
                          : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--color-text-muted)]">Kontribusi</dt>
                  <dd data-testid="component-contribution" className="font-medium">
                    {contribution ? formatMoney(contribution, currency) : '—'}
                  </dd>
                </div>
              </dl>
            ) : null}

            {fixed ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <DCurrencyInput
                  label="Harga khusus per unit"
                  value={component.fixedPrice}
                  placeholder="Rp 0"
                  disabled={disabled}
                  onValueChange={(fixedPrice) => onChange({ fixedPrice })}
                  error={issue === 'FIXED_PRICE_INVALID' ? visibleIssue : undefined}
                />
                <div className="text-sm">
                  <p className="text-xs text-[var(--color-text-muted)]">Kontribusi</p>
                  <p data-testid="component-contribution" className="mt-2 font-medium">
                    {contribution ? formatMoney(contribution, currency) : '—'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
