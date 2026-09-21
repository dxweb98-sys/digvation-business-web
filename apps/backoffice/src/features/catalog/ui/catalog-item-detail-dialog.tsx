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
import {
  BadgeDollarSign,
  Briefcase,
  Clock,
  Layers,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type { LoyaltyApi } from '../../../modules/loyalty/loyalty-api';
import type {
  CatalogApi,
  CatalogManagementItem,
  Category,
  DefaultPrice,
  Variant,
} from '../api/catalog-api';
import { useCatalogLocalization } from '../localization/use-catalog-localization';
import {
  explicitVariantPriceRange,
  variantPriceState,
  type VariantPriceState,
} from '../model/catalog-price-history';
import { sellingModel, sellingModelCopy } from '../model/catalog-selling';
import { sameAmount } from '../item-editor/model/variant-price-draft';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { CatalogLoyaltyTile } from './catalog-loyalty-section';
import {
  ItemPriceHistory,
  PriceChangeDialog,
  VariantBulkPriceDialog,
  VariantPriceLabel,
} from './catalog-pricing';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { SellingModelBadge } from './catalog-selling';
import {
  CatalogInfoTile,
  CatalogPanel,
  CatalogPanelHeader,
  PriceLabel,
  Status,
} from './catalog-shared';

const HISTORY_PREVIEW = 5;

type SellingOptionRow =
  | { kind: 'item'; id: string }
  | { kind: 'variant'; id: string; variant: Variant };

const keys = {
  prices: (itemId: string) => ['catalog', 'prices', itemId] as const,
  variants: (itemId: string) => ['catalog', 'variants', itemId] as const,
  variantPrice: (
    itemId: string,
    variantId: string,
    currency: string,
    effectiveAt: string,
  ) => ['catalog', 'variant-price', itemId, variantId, currency, effectiveAt] as const,
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
  const [activeDetailTab, setActiveDetailTab] = useState<'variants' | 'history'>('variants');
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
  const variantsWithoutPrice = activeVariants.filter(
    (variant) => variantStates.get(variant.id)?.kind === 'missing',
  ).length;

  const refreshPricing = () => {
    onPricingChanged();
    void client.invalidateQueries({ queryKey: ['catalog', 'variant-price'] });
  };
  const refreshVariants = () =>
    void client.invalidateQueries({ queryKey: keys.variants(item.id) });
  const refreshVariantsAndCount = () => {
    refreshVariants();
    onVariantsChanged();
  };

  const model = sellingModel(hasVariants, item.variantSelectionMode);
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
      label: 'Varian & SKU',
      render: (row) =>
        row.kind === 'item' ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-text-muted)]/35" />
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-text)]">Tanpa varian</p>
              <p className="text-xs text-[var(--color-text-muted)]">Item induk</p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-brand)]" />
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-text)]">{row.variant.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">SKU: {row.variant.code}</p>
            </div>
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

  const displayPrice =
    model === 'DIRECT'
      ? null
      : optionRange
        ? sameAmount(optionRange.min.amount, optionRange.max.amount)
          ? formatMoney(optionRange.min.amount, optionRange.min.currency)
          : `${formatMoney(optionRange.min.amount, optionRange.min.currency)} – ${formatMoney(
              optionRange.max.amount,
              optionRange.max.currency,
            )}`
        : '—';

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
      title={
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
          <span>Detail Item & Layanan</span>
        </div>
      }
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
      <div className="space-y-5">
        <CatalogPanel className="p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-stretch">
            <div className="flex min-w-0 gap-4">
              <CatalogItemThumbnail
                api={api}
                itemId={item.id}
                itemName={item.name}
                size="detail"
              />
              <div className="min-w-0 flex-1 self-center">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-xl font-semibold tracking-tight text-[var(--color-text)]">
                    {item.name}
                  </h2>
                  <Status value={item.lifecycle} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text)]">
                    {item.code}
                  </span>
                  <span>•</span>
                  <span>{item.type === 'SERVICE' ? 'Jasa' : 'Produk'}</span>
                  <span>•</span>
                  <span className="font-medium text-[var(--color-brand)]">{categoryName}</span>
                </div>
                {item.type === 'SERVICE' ? (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Clock className="size-3.5" aria-hidden="true" />
                    <span>
                      Durasi:{' '}
                      <strong className="font-medium text-[var(--color-text)]">
                        {item.serviceDefinition?.defaultDurationMinutes != null
                          ? `${item.serviceDefinition.defaultDurationMinutes} menit`
                          : 'Belum diatur'}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {canViewPricing ? (
              <div className="flex min-h-28 flex-col justify-center border-t border-[var(--color-border)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    {model === 'DIRECT' ? 'Harga Jual' : 'Ringkasan Harga'}
                  </span>
                  {variants.isLoading ? null : <SellingModelBadge model={model} />}
                </div>
                <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-text)]">
                  {model === 'DIRECT' ? (
                    <PriceLabel
                      price={defaultPrice}
                      loading={defaultPriceLoading}
                      emptyLabel="Belum diatur"
                    />
                  ) : (
                    displayPrice
                  )}
                </div>
                <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--color-text-muted)]">
                  {sellingModelCopy[model].description}
                </p>
                {canCreatePricing && model === 'DIRECT' ? (
                  <div className="mt-3">
                    <DButton
                      variant="outline"
                      size="sm"
                      leftIcon={<BadgeDollarSign className="size-4" />}
                      onClick={() => setPricingTarget('default')}
                    >
                      {defaultPrice ? 'Ubah harga' : 'Atur harga'}
                    </DButton>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </CatalogPanel>

        <CatalogPanel className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
            Informasi Tambahan
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CatalogInfoTile
              label="Tipe Produk / Item"
              icon={<Briefcase className="size-3.5" aria-hidden="true" />}
              value={item.type === 'SERVICE' ? 'Jasa (Layanan)' : 'Produk'}
            />
            <CatalogInfoTile
              label="Kategori"
              icon={<Tag className="size-3.5" aria-hidden="true" />}
              value={categoryName}
            />
            <CatalogInfoTile
              label={item.type === 'SERVICE' ? 'Durasi Pengerjaan' : 'Mode Penjualan'}
              icon={<Clock className="size-3.5" aria-hidden="true" />}
              value={
                item.type === 'SERVICE'
                  ? item.serviceDefinition?.defaultDurationMinutes != null
                    ? `${item.serviceDefinition.defaultDurationMinutes} menit`
                    : 'Belum diatur'
                  : sellingModelCopy[model].label
              }
            />
            {canViewLoyalty ? <CatalogLoyaltyTile item={item} api={loyaltyApi} /> : null}
          </div>

          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
              Deskripsi Item
            </p>
            <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-3 py-2.5 text-sm">
              {item.description?.trim() ? (
                <p className="text-[var(--color-text)]">{item.description.trim()}</p>
              ) : (
                <p className="italic text-[var(--color-text-muted)]">
                  Tidak ada deskripsi yang ditambahkan untuk item ini.
                </p>
              )}
            </div>
          </div>
        </CatalogPanel>

        <CatalogPanel>
          <div className="border-b border-[var(--color-border)] px-4 pt-3">
            <div
              role="tablist"
              aria-label="Detail item"
              className="flex min-w-0 gap-1 overflow-x-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeDetailTab === 'variants'}
                onClick={() => setActiveDetailTab('variants')}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeDetailTab === 'variants'
                    ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                Daftar Varian
                <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px]">
                  {model === 'ITEM_AND_VARIANTS' ? optionRows.length : variantCount}
                </span>
              </button>
              {canViewPricing ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDetailTab === 'history'}
                  onClick={() => setActiveDetailTab('history')}
                  className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    activeDetailTab === 'history'
                      ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  Riwayat Harga
                  <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px]">
                    {history.length}
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          {activeDetailTab === 'variants' || !canViewPricing ? (
            <div role="tabpanel" aria-label="Daftar Varian">
              <CatalogPanelHeader
                title="Daftar Varian"
                description={
                  model === 'ITEM_AND_VARIANTS'
                    ? 'Item utama tetap bisa dijual, dengan varian sebagai pilihan tambahan.'
                    : model === 'VARIANT_REQUIRED'
                      ? 'Kasir wajib memilih salah satu varian sebelum checkout.'
                      : 'Item ini belum menggunakan varian.'
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
                        Terapkan harga ke semua
                      </DButton>
                    ) : null}
                    {canCreate ? (
                      <DButton
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="size-4" />}
                        onClick={() => setEditingVariant(null)}
                      >
                        Tambah varian
                      </DButton>
                    ) : null}
                  </>
                }
              />
              {canViewPricing && variantsWithoutPrice > 0 ? (
                <div className="px-4 pt-4">
                  <DInfoNote variant="warning">
                    {variantsWithoutPrice} varian aktif belum memiliki harga dan tidak bisa dijual.
                    {canCreatePricing
                      ? ' Terapkan satu harga ke semua varian atau atur harga tiap varian.'
                      : ''}
                  </DInfoNote>
                </div>
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
                      canCreatePricing &&
                      row.kind === 'variant' &&
                      row.variant.status === 'ACTIVE',
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
            </div>
          ) : (
            <div role="tabpanel" aria-label="Riwayat Harga">
              <CatalogPanelHeader
                title="Riwayat Perubahan Harga"
                description="Perubahan harga terbaru ditampilkan lebih dulu."
                count={history.length}
              />
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
                <div className="flex justify-center border-t border-[var(--color-border)] px-4 py-3">
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
            </div>
          )}
        </CatalogPanel>
      </div>

      <CatalogNamedRecordDialog
        key={`detail-variant-${
          editingVariant?.id ?? (editingVariant === null ? 'new' : 'closed')
        }`}
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
        key={`price-${
          pricingTarget === 'default' ? 'item' : (pricingTarget?.id ?? 'closed')
        }`}
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
