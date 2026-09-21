import {
  DButton,
  DConfirmDialog,
  DDataTable,
  DDialog,
  DInfoNote,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Layers, Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type {
  CatalogApi,
  CatalogManagementItem,
  Category,
  DefaultPrice,
  Variant,
} from '../api/catalog-api';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { CatalogLoyaltySection } from './catalog-loyalty-section';
import type { LoyaltyApi } from '../../../modules/loyalty/loyalty-api';
import { useCatalogLocalization } from '../localization/use-catalog-localization';
import {
  explicitVariantPriceRange,
  variantPriceState,
  type VariantPriceState,
} from '../model/catalog-price-history';
import {
  ItemPriceHistory,
  PriceChangeDialog,
  VariantBulkPriceDialog,
  VariantPriceLabel,
} from './catalog-pricing';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { sellingModel, sellingModelCopy } from '../model/catalog-selling';
import { SellingModelBadge } from './catalog-selling';
import { CatalogSection, DetailField, PriceLabel, Status } from './catalog-shared';
import { sameAmount } from '../item-editor/model/variant-price-draft';

const HISTORY_PREVIEW = 5;

type SellingOptionRow =
  { kind: 'item'; id: string } | { kind: 'variant'; id: string; variant: Variant };

const keys = {
  prices: (itemId: string) => ['catalog', 'prices', itemId] as const,
  variants: (itemId: string) => ['catalog', 'variants', itemId] as const,
  variantPrice: (itemId: string, variantId: string, currency: string, effectiveAt: string) =>
    ['catalog', 'variant-price', itemId, variantId, currency, effectiveAt] as const,
};

export function CatalogItemDetailDialog({
  item,
  categories,
  defaultPrice,
  defaultPriceLoading,
  currency,
  effectiveAt,
  api,
  loyaltyApi,
  canViewLoyalty,
  canCreate,
  canUpdate,
  canViewPricing,
  canCreatePricing,
  canCancelPricing,
  onPricingChanged,
  onVariantsChanged,
  onClose,
  onEdit,
}: {
  item: CatalogManagementItem | null;
  categories: Category[];
  defaultPrice: DefaultPrice | undefined;
  defaultPriceLoading: boolean;
  currency: string;
  effectiveAt: string;
  api: CatalogApi;
  loyaltyApi: LoyaltyApi;
  canViewLoyalty: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canViewPricing: boolean;
  canCreatePricing: boolean;
  canCancelPricing: boolean;
  onPricingChanged: () => void;
  onVariantsChanged: () => void;
  onClose: () => void;
  onEdit: (item: CatalogManagementItem) => void;
}) {
  const client = useQueryClient();
  const { showToast } = useToast();
  const { formatMoney } = useCatalogLocalization();
  const [editingVariant, setEditingVariant] = useState<Variant | null | undefined>();
  const [pricingTarget, setPricingTarget] = useState<'default' | Variant | null>(null);
  const [bulkPricing, setBulkPricing] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Variant | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const variants = useQuery({
    queryKey: keys.variants(item?.id ?? ''),
    queryFn: () => api.listVariants(item!.id),
    enabled: Boolean(item),
  });
  const priceHistory = useQuery({
    queryKey: keys.prices(item?.id ?? ''),
    queryFn: () => api.listPrices(item!.id),
    enabled: Boolean(item && canViewPricing),
  });
  const resolvedVariantPrices = useQueries({
    queries: (variants.data?.items ?? []).map((variant) => ({
      queryKey: keys.variantPrice(item?.id ?? '', variant.id, currency, effectiveAt),
      queryFn: () =>
        api.resolvePrice({
          catalogItemId: item!.id,
          catalogVariantId: variant.id,
          currency,
          effectiveAt,
        }),
      enabled: Boolean(item && canViewPricing),
    })),
  });

  if (!item) return null;

  const categoryName = item.categoryId
    ? (categories.find((candidate) => candidate.id === item.categoryId)?.name ?? item.categoryId)
    : 'Belum ditentukan';
  // Location-specific prices are managed elsewhere; this history covers the item and its variants.
  const history = (priceHistory.data?.items ?? []).filter((price) => price.locationId === null);
  const variantStates = new Map<string, VariantPriceState>(
    (variants.data?.items ?? []).map((variant, index) => [
      variant.id,
      variantPriceState(resolvedVariantPrices[index], variant.id),
    ]),
  );
  const variantCount = variants.data?.items.length ?? item.variantCount;
  const activeVariants = (variants.data?.items ?? []).filter(
    (variant) => variant.status === 'ACTIVE',
  );
  const hasVariants = activeVariants.length > 0;
  const variantsWithoutPrice = activeVariants.filter((variant) => {
    return variantStates.get(variant.id)?.kind === 'missing';
  }).length;
  const refreshPricing = () => {
    onPricingChanged();
    void client.invalidateQueries({ queryKey: ['catalog', 'variant-price'] });
  };

  const refreshVariants = () => void client.invalidateQueries({ queryKey: keys.variants(item.id) });
  const refreshVariantsAndCount = () => {
    refreshVariants();
    onVariantsChanged();
  };

  const model = sellingModel(hasVariants, item.variantSelectionMode);
  // Sellable options as the cashier sees them: the item itself (when it is sold without a
  // variant) followed by every variant at its own price.
  const optionRows: SellingOptionRow[] = [
    ...(model === 'ITEM_AND_VARIANTS' ? [{ kind: 'item' as const, id: 'item' }] : []),
    ...(variants.data?.items ?? []).map((variant) => ({
      kind: 'variant' as const,
      id: variant.id,
      variant,
    })),
  ];
  const optionColumns: TableColumn<SellingOptionRow>[] = [
    {
      key: 'name',
      label: model === 'ITEM_AND_VARIANTS' ? 'Pilihan' : 'Varian',
      render: (row) =>
        row.kind === 'item' ? (
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-text)]">Tanpa varian</p>
            <p className="text-xs text-[var(--color-text-muted)]">Item dijual sendiri</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-text)]">{row.variant.name}</p>
            <p className="text-xs text-[var(--color-text-muted)]">SKU {row.variant.code}</p>
          </div>
        ),
    },
    ...(canViewPricing
      ? [
          {
            key: 'price',
            label: 'Harga',
            render: (row: SellingOptionRow) => (
              <div className="font-semibold tabular-nums">
                {row.kind === 'item' ? (
                  <PriceLabel
                    price={defaultPrice}
                    loading={defaultPriceLoading}
                    emptyLabel="Belum diatur"
                  />
                ) : (
                  <VariantPriceLabel
                    state={variantStates.get(row.variant.id) ?? { kind: 'loading' }}
                  />
                )}
              </div>
            ),
          } as TableColumn<SellingOptionRow>,
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (row) =>
        row.kind === 'item' ? <Status value="ACTIVE" /> : <Status value={row.variant.status} />,
    },
  ];
  const optionRange = explicitVariantPriceRange([
    ...(model === 'ITEM_AND_VARIANTS' && defaultPrice
      ? [
          {
            kind: 'explicit' as const,
            amount: defaultPrice.amount,
            currency: defaultPrice.currency,
          },
        ]
      : []),
    ...activeVariants.map(
      (variant) => variantStates.get(variant.id) ?? { kind: 'loading' as const },
    ),
  ]);
  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);

  const confirmVariantStatus = async () => {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true);
    try {
      await api.updateVariant(item.id, statusTarget, {
        status: statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setStatusTarget(null);
      refreshVariantsAndCount();
      void client.invalidateQueries({ queryKey: ['catalog', 'default-prices'] });
      showToast({ variant: 'success', title: 'Varian berhasil diperbarui.' });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Varian tidak dapat diperbarui.').safeMessage,
        });
      }
    } finally {
      setChangingStatus(false);
    }
  };

  return (
    <DDialog
      open
      onClose={onClose}
      size="xl"
      title="Detail Item"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            Tutup
          </DButton>
          {canUpdate ? (
            <DButton leftIcon={<Pencil className="size-4" />} onClick={() => onEdit(item)}>
              Edit Item
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="divide-y divide-[var(--color-border)]">
        <section className="pb-6" aria-label="Ringkasan item">
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <CatalogItemThumbnail api={api} itemId={item.id} itemName={item.name} size="detail" />
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                    {item.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {item.code} · {item.type === 'SERVICE' ? 'Jasa' : 'Produk'} · {categoryName}
                  </p>
                </div>
                <Status value={item.lifecycle} />
              </div>

              {canViewPricing ? (
                <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-[var(--color-surface-muted)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-[var(--color-text-muted)]">
                        {model === 'DIRECT'
                          ? 'Harga jual'
                          : model === 'ITEM_AND_VARIANTS'
                            ? 'Pilihan harga'
                            : 'Harga varian'}
                      </p>
                      {variants.isLoading ? null : <SellingModelBadge model={model} />}
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                      {model === 'DIRECT' ? (
                        <PriceLabel
                          price={defaultPrice}
                          loading={defaultPriceLoading}
                          emptyLabel="Belum diatur"
                        />
                      ) : optionRange ? (
                        sameAmount(optionRange.min.amount, optionRange.max.amount) ? (
                          formatMoney(optionRange.min.amount, optionRange.min.currency)
                        ) : (
                          `${formatMoney(optionRange.min.amount, optionRange.min.currency)} – ${formatMoney(optionRange.max.amount, optionRange.max.currency)}`
                        )
                      ) : (
                        '—'
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {sellingModelCopy[model].description}
                    </p>
                  </div>
                  {canCreatePricing && model === 'DIRECT' ? (
                    <DButton
                      variant="outline"
                      size="sm"
                      leftIcon={<BadgeDollarSign className="size-4" />}
                      onClick={() => setPricingTarget('default')}
                    >
                      {defaultPrice ? 'Ubah harga' : 'Atur harga'}
                    </DButton>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <CatalogSection
          title={model === 'ITEM_AND_VARIANTS' ? 'Pilihan harga' : 'Varian'}
          count={model === 'ITEM_AND_VARIANTS' ? optionRows.length : variantCount}
          description={
            model === 'ITEM_AND_VARIANTS'
              ? 'Kasir memilih salah satu: tanpa varian atau salah satu varian.'
              : model === 'VARIANT_REQUIRED'
                ? 'Kasir wajib memilih salah satu varian.'
                : undefined
          }
          actions={
            <>
              {canCreatePricing && hasVariants ? (
                <DButton
                  variant="secondary"
                  size="sm"
                  leftIcon={<Layers className="size-4" />}
                  onClick={() => setBulkPricing(true)}
                >
                  Terapkan harga ke semua varian
                </DButton>
              ) : null}
              {canCreate ? (
                <DButton
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="size-4" />}
                  onClick={() => setEditingVariant(null)}
                >
                  Tambah varian
                </DButton>
              ) : null}
            </>
          }
        >
          {canViewPricing && variantsWithoutPrice > 0 ? (
            <DInfoNote variant="warning" className="mb-4">
              {variantsWithoutPrice} varian aktif belum memiliki harga dan tidak bisa dijual.
              {canCreatePricing
                ? ' Terapkan satu harga ke semua varian atau atur harga tiap varian.'
                : ''}
            </DInfoNote>
          ) : null}
          <DDataTable
            columns={optionColumns}
            data={optionRows}
            loading={variants.isLoading}
            rowKey="id"
            emptyMessage="Item ini tidak memiliki varian."
            actions={[
              {
                label: 'Ubah harga',
                icon: <BadgeDollarSign className="size-4" />,
                onClick: () => setPricingTarget('default'),
                show: (row) => canCreatePricing && row.kind === 'item',
              },
              {
                label: 'Ubah harga varian',
                icon: <BadgeDollarSign className="size-4" />,
                onClick: (row) => row.kind === 'variant' && setPricingTarget(row.variant),
                show: (row) =>
                  canCreatePricing && row.kind === 'variant' && row.variant.status === 'ACTIVE',
              },
              {
                label: 'Edit varian',
                icon: <Pencil className="size-4" />,
                onClick: (row) => row.kind === 'variant' && setEditingVariant(row.variant),
                show: (row) => canUpdate && row.kind === 'variant',
              },
              {
                label: 'Nonaktifkan varian',
                icon: <Power className="size-4" />,
                onClick: (row) => row.kind === 'variant' && setStatusTarget(row.variant),
                show: (row) =>
                  canUpdate && row.kind === 'variant' && row.variant.status === 'ACTIVE',
              },
              {
                label: 'Aktifkan varian',
                icon: <RotateCcw className="size-4" />,
                onClick: (row) => row.kind === 'variant' && setStatusTarget(row.variant),
                show: (row) =>
                  canUpdate && row.kind === 'variant' && row.variant.status === 'INACTIVE',
              },
            ]}
          />
        </CatalogSection>

        {canViewLoyalty ? <CatalogLoyaltySection item={item} api={loyaltyApi} /> : null}

        <CatalogSection title="Informasi item" tone="secondary">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Tipe" value={item.type === 'SERVICE' ? 'Jasa' : 'Produk'} />
            <DetailField label="Kategori" value={categoryName} />
            {item.type === 'SERVICE' ? (
              <DetailField
                label="Durasi Layanan"
                value={
                  item.serviceDefinition?.defaultDurationMinutes != null
                    ? `${item.serviceDefinition.defaultDurationMinutes} menit`
                    : 'Belum diatur'
                }
              />
            ) : null}
            <div className="sm:col-span-2 lg:col-span-4">
              <DetailField
                label="Deskripsi"
                value={item.description?.trim() || 'Tidak ada deskripsi'}
              />
            </div>
          </dl>
        </CatalogSection>

        {canViewPricing ? (
          <CatalogSection
            title="Riwayat Harga Item"
            tone="secondary"
            count={history.length}
            description="Perubahan harga item dan semua varian, terbaru di atas."
          >
            <ItemPriceHistory
              entries={visibleHistory}
              loading={priceHistory.isLoading}
              error={priceHistory.isError}
              canCancel={canCancelPricing}
              onCancel={async (price) => {
                await api.cancelPrice(price.id);
                refreshPricing();
              }}
            />
            {history.length > HISTORY_PREVIEW ? (
              <div className="mt-3 flex justify-center">
                <DButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllHistory((current) => !current)}
                >
                  {showAllHistory
                    ? 'Tampilkan lebih sedikit'
                    : `Tampilkan semua riwayat (${history.length})`}
                </DButton>
              </div>
            ) : null}
          </CatalogSection>
        ) : null}
      </div>

      <CatalogNamedRecordDialog
        key={`detail-variant-${editingVariant?.id ?? (editingVariant === null ? 'new' : 'closed')}`}
        entity="Variant"
        item={editingVariant}
        onClose={() => setEditingVariant(undefined)}
        onSave={async (existing, input) =>
          existing
            ? api.updateVariant(item.id, existing as Variant, input)
            : api.createVariant(item.id, input)
        }
        onSaved={refreshVariantsAndCount}
      />

      <PriceChangeDialog
        key={`price-${pricingTarget === 'default' ? 'item' : (pricingTarget?.id ?? 'closed')}`}
        target={pricingTarget}
        item={item}
        currency={currency}
        api={api}
        onClose={() => setPricingTarget(null)}
        onSaved={refreshPricing}
      />

      {bulkPricing ? (
        <VariantBulkPriceDialog
          open
          item={item}
          currency={currency}
          variants={variants.data?.items ?? []}
          variantStates={variantStates}
          api={api}
          onClose={() => setBulkPricing(false)}
          onSaved={refreshPricing}
        />
      ) : null}

      <DConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void confirmVariantStatus()}
        title={statusTarget?.status === 'ACTIVE' ? 'Nonaktifkan varian?' : 'Aktifkan varian?'}
        message={
          statusTarget?.status === 'ACTIVE'
            ? 'Varian tidak akan tersedia untuk penggunaan baru sampai diaktifkan kembali.'
            : 'Varian akan tersedia kembali untuk penggunaan baru.'
        }
        confirmLabel={statusTarget?.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </DDialog>
  );
}
