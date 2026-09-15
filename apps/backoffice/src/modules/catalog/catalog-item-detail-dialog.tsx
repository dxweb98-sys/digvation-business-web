import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDataTable,
  DDialog,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type {
  CatalogApi,
  CatalogManagementItem,
  Category,
  DefaultPrice,
  TaxCategory,
  Variant,
} from './catalog-api';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { PriceChangeDialog, PriceHistoryTable, VariantPriceLabel } from './catalog-pricing';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { DetailField, PriceLabel, Status } from './catalog-shared';

const keys = {
  prices: (itemId: string) => ['catalog', 'prices', itemId] as const,
  variants: (itemId: string) => ['catalog', 'variants', itemId] as const,
  variantPrice: (itemId: string, variantId: string, currency: string, effectiveAt: string) =>
    ['catalog', 'variant-price', itemId, variantId, currency, effectiveAt] as const,
};

export function CatalogItemDetailDialog({
  item,
  categories,
  taxCategories,
  defaultPrice,
  defaultPriceLoading,
  currency,
  effectiveAt,
  api,
  canCreate,
  canUpdate,
  canViewPricing,
  canCreatePricing,
  canCancelPricing,
  canViewTax,
  onPricingChanged,
  onVariantsChanged,
  onClose,
  onEdit,
}: {
  item: CatalogManagementItem | null;
  categories: Category[];
  taxCategories: TaxCategory[];
  defaultPrice: DefaultPrice | undefined;
  defaultPriceLoading: boolean;
  currency: string;
  effectiveAt: string;
  api: CatalogApi;
  canCreate: boolean;
  canUpdate: boolean;
  canViewPricing: boolean;
  canCreatePricing: boolean;
  canCancelPricing: boolean;
  canViewTax: boolean;
  onPricingChanged: () => void;
  onVariantsChanged: () => void;
  onClose: () => void;
  onEdit: (item: CatalogManagementItem) => void;
}) {
  const client = useQueryClient();
  const { showToast } = useToast();
  const [editingVariant, setEditingVariant] = useState<Variant | null | undefined>();
  const [pricingTarget, setPricingTarget] = useState<'default' | Variant | null>(null);
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
  const taxCategoryName = item.taxCategoryId
    ? (taxCategories.find((candidate) => candidate.id === item.taxCategoryId)?.name ??
      item.taxCategoryId)
    : 'Tidak ada pajak khusus item';
  const defaultHistory = (priceHistory.data?.items ?? []).filter(
    (price) => price.catalogVariantId === null && price.locationId === null,
  );
  const variantPriceById = new Map(
    (variants.data?.items ?? []).map((variant, index) => [
      variant.id,
      resolvedVariantPrices[index],
    ]),
  );
  const variantCount = variants.data?.items.length ?? item.variantCount;

  const refreshVariants = () => void client.invalidateQueries({ queryKey: keys.variants(item.id) });
  const refreshVariantsAndCount = () => {
    refreshVariants();
    onVariantsChanged();
  };

  const variantColumns: TableColumn<Variant>[] = [
    { key: 'code', label: 'Kode' },
    { key: 'name', label: 'Nama Varian' },
    ...(canViewPricing
      ? [
          {
            key: 'price',
            label: 'Harga',
            render: (variant: Variant) => (
              <VariantPriceLabel
                query={variantPriceById.get(variant.id)}
                variantId={variant.id}
                currency={currency}
              />
            ),
          } as TableColumn<Variant>,
        ]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (variant) => <Status value={variant.status} />,
    },
  ];

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
      <div>
        <section className="border-b border-[var(--color-border)] pb-5">
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <CatalogItemThumbnail api={api} itemId={item.id} itemName={item.name} size="detail" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-4">
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

              <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[var(--color-border)] pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    Harga Saat Ini
                  </p>
                  <div className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                    {canViewPricing ? (
                      <PriceLabel
                        price={defaultPrice}
                        loading={defaultPriceLoading}
                        available
                        emptyLabel="Belum diatur"
                      />
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                {canCreatePricing ? (
                  <DButton
                    leftIcon={<BadgeDollarSign className="size-4" />}
                    onClick={() => setPricingTarget('default')}
                  >
                    {defaultPrice ? 'Ubah Harga' : 'Atur Harga'}
                  </DButton>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--color-border)] py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Varian</h2>
              <DBadge variant="secondary">{variantCount}</DBadge>
            </div>
            {canCreate ? (
              <DButton
                leftIcon={<Plus className="size-4" />}
                onClick={() => setEditingVariant(null)}
              >
                Tambah Varian
              </DButton>
            ) : null}
          </div>
          <div className="mt-4">
            <DDataTable
              columns={variantColumns}
              data={variants.data?.items ?? []}
              loading={variants.isLoading}
              rowKey="id"
              emptyMessage="Item ini belum memiliki varian."
              actions={[
                {
                  label: 'Edit varian',
                  icon: <Pencil className="size-4" />,
                  onClick: setEditingVariant,
                  show: () => canUpdate,
                },
                {
                  label: 'Ubah harga varian',
                  icon: <BadgeDollarSign className="size-4" />,
                  onClick: setPricingTarget,
                  show: () => canViewPricing,
                },
                {
                  label: 'Nonaktifkan varian',
                  icon: <Power className="size-4" />,
                  onClick: setStatusTarget,
                  show: (variant) => canUpdate && variant.status === 'ACTIVE',
                },
                {
                  label: 'Aktifkan varian',
                  icon: <RotateCcw className="size-4" />,
                  onClick: setStatusTarget,
                  show: (variant) => canUpdate && variant.status === 'INACTIVE',
                },
              ]}
            />
          </div>
        </section>

        {canViewPricing ? (
          <section className="border-b border-[var(--color-border)] py-5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Riwayat Harga</h2>
              <DBadge variant="secondary">{defaultHistory.length}</DBadge>
            </div>
            <div className="mt-4">
              <PriceHistoryTable
                prices={defaultHistory}
                currency={currency}
                loading={priceHistory.isLoading}
                canCancel={canCancelPricing}
                onCancel={async (price) => {
                  await api.cancelPrice(price.id);
                  onPricingChanged();
                }}
                emptyMessage="Belum ada riwayat harga."
              />
            </div>
          </section>
        ) : null}

        <section className="pt-5">
          <h2 className="text-base font-semibold">Informasi Item</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Tipe" value={item.type === 'SERVICE' ? 'Jasa' : 'Produk'} />
            <DetailField label="Kategori" value={categoryName} />
            <DetailField label="Status" value={<Status value={item.lifecycle} />} />
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
            {canViewTax ? <DetailField label="Kategori Pajak" value={taxCategoryName} /> : null}
            <div className="sm:col-span-2 lg:col-span-4">
              <DetailField
                label="Deskripsi"
                value={item.description?.trim() || 'Tidak ada deskripsi'}
              />
            </div>
          </dl>
        </section>
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
        target={pricingTarget}
        item={item}
        currency={currency}
        prices={(priceHistory.data?.items ?? []).filter((price) =>
          pricingTarget === 'default'
            ? price.catalogVariantId === null && price.locationId === null
            : pricingTarget
              ? price.catalogVariantId === pricingTarget.id && price.locationId === null
              : false,
        )}
        historyLoading={priceHistory.isLoading}
        canCreate={canCreatePricing}
        canCancel={canCancelPricing}
        api={api}
        onClose={() => setPricingTarget(null)}
        onSaved={() => {
          onPricingChanged();
          void client.invalidateQueries({ queryKey: ['catalog', 'variant-price'] });
        }}
      />

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
