import { DCurrencyInput, DDialog, DInput, DSelect, DTextarea, useToast } from '@digvation/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { CatalogApi, Category, Item, VariantSelectionMode } from './catalog-api';
import { CatalogItemImageField } from './catalog-item-image-field';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { useCatalogLocalization } from './catalog-localization';
import { variantPriceState } from './catalog-price-history';
import {
  SellingModeChoice,
  SellingModelBadge,
  sellingModel,
  sellingModelCopy,
  sellsItemItself,
} from './catalog-selling';
import { CatalogSection, DialogFooter, Status } from './catalog-shared';
import {
  editableAmount,
  isValidSellingPrice,
  sameAmount,
  variantDraftIssue,
  variantPriceSubmissions,
  type VariantPriceDraft,
} from './catalog-variant-price-draft';
import { VariantPriceEditor } from './catalog-variant-price-editor';

function validOptionalMoney(value: string) {
  return !value.trim() || isValidSellingPrice(value);
}

export function CatalogItemDialog({
  item,
  categories,
  currency,
  api,
  canViewPricing,
  canCreatePricing,
  canCreateVariants,
  canManageImage,
  onClose,
  onSaved,
}: {
  item: Item | null | undefined;
  categories: Category[];
  currency: string;
  api: CatalogApi;
  canViewPricing: boolean;
  canCreatePricing: boolean;
  canCreateVariants: boolean;
  canManageImage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fresh = item === null;
  const client = useQueryClient();
  const { showToast } = useToast();
  const { formatMoney } = useCatalogLocalization();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<Item['type']>(item?.type ?? 'PRODUCT');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? null);
  const [description, setDescription] = useState(item?.description ?? '');
  const [lifecycle, setLifecycle] = useState<Item['lifecycle']>(item?.lifecycle ?? 'DRAFT');
  const [variantSelectionMode, setVariantSelectionMode] = useState<VariantSelectionMode>(
    item?.variantSelectionMode ?? 'REQUIRED',
  );
  const [defaultPrice, setDefaultPrice] = useState('');
  const initialPriceRef = useRef<string | null | undefined>(undefined);
  const [variants, setVariants] = useState<VariantPriceDraft[]>([]);
  const variantsLoadedRef = useRef(false);
  const [showIssues, setShowIssues] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    item?.serviceDefinition?.defaultDurationMinutes?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [effectiveAt] = useState(() => new Date().toISOString());

  const existingImage = useQuery({
    queryKey: ['catalog', 'image', item?.id ?? 'new'],
    queryFn: () => api.getItemImage(item!.id),
    enabled: Boolean(item),
    staleTime: 60_000,
  });
  const currentPrice = useQuery({
    queryKey: ['catalog', 'edit-price', item?.id ?? 'new', currency],
    queryFn: () => api.listDefaultPrices([item!.id], currency, effectiveAt),
    enabled: Boolean(item && canViewPricing),
  });
  // Edit: existing active variants and the explicit price Runtime currently holds for each.
  const existingVariants = useQuery({
    queryKey: ['catalog', 'variants', item?.id ?? 'new'],
    queryFn: () => api.listVariants(item!.id),
    enabled: Boolean(item && canViewPricing),
  });
  const activeVariants = (existingVariants.data?.items ?? []).filter(
    (variant) => variant.status === 'ACTIVE',
  );
  const variantPrices = useQueries({
    queries: activeVariants.map((variant) => ({
      queryKey: ['catalog', 'edit-variant-price', item?.id ?? 'new', variant.id, currency],
      queryFn: () =>
        api.resolvePrice({
          catalogItemId: item!.id,
          catalogVariantId: variant.id,
          currency,
          effectiveAt,
        }),
      retry: false,
    })),
  });
  const variantPricesLoading =
    existingVariants.isLoading || variantPrices.some((query) => query.isLoading);

  useEffect(() => {
    if (fresh || initialPriceRef.current !== undefined || currentPrice.isLoading) return;
    const amount = currentPrice.data?.items[0]?.amount ?? null;
    initialPriceRef.current = amount;
    setDefaultPrice(amount ? editableAmount(amount) : '');
  }, [currentPrice.data, currentPrice.isLoading, fresh]);

  useEffect(() => {
    if (fresh || variantsLoadedRef.current || variantPricesLoading || !existingVariants.data)
      return;
    variantsLoadedRef.current = true;
    setVariants(
      activeVariants.map((variant, index) => {
        const state = variantPriceState(variantPrices[index], variant.id);
        const persistedPrice = state.kind === 'explicit' ? state.amount : null;
        return {
          key: variant.id,
          id: variant.id,
          code: variant.code,
          name: variant.name,
          price: persistedPrice ? editableAmount(persistedPrice) : '',
          persistedPrice,
          priceUnknown: state.kind === 'unavailable',
        };
      }),
    );
    // Drafts are seeded once from the first complete read; later refetches must not reset edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, variantPricesLoading, existingVariants.data]);

  const parsedDefaultDuration = defaultDurationMinutes.trim()
    ? Number(defaultDurationMinutes)
    : null;
  const validDefaultDuration =
    parsedDefaultDuration === null ||
    (Number.isInteger(parsedDefaultDuration) && parsedDefaultDuration > 0);
  const storedItemPrice = fresh ? null : (currentPrice.data?.items[0]?.amount ?? null);
  const hasVariants = variants.length > 0;
  const model = sellingModel(hasVariants, variantSelectionMode);
  // The price without a variant is a real sellable option, so it is required in that model.
  const itemPriceRequired = model === 'ITEM_AND_VARIANTS';
  const itemPriceMissing = itemPriceRequired && !isValidSellingPrice(defaultPrice);
  const validPrice = !sellsItemItself(model) || validOptionalMoney(defaultPrice);
  const itemPriceError = !validPrice
    ? 'Harga harus lebih dari nol.'
    : showIssues && itemPriceMissing
      ? 'Isi harga tanpa varian.'
      : undefined;
  const showPrice = canViewPricing || (fresh && canCreatePricing);
  const canEditPrice = fresh ? canCreatePricing : canViewPricing && canCreatePricing;
  const showVariants = fresh ? canCreateVariants : canViewPricing && variants.length > 0;
  const variantsHaveIssues =
    variants.some((draft) => variantDraftIssue(draft, canEditPrice)) ||
    (canEditPrice && itemPriceMissing);
  const disabled = !name.trim() || !validDefaultDuration || !validPrice || saving;
  const inactiveVariantCount = (existingVariants.data?.items ?? []).length - activeVariants.length;

  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.status === 'ACTIVE' || category.id === item?.categoryId,
      ),
    [categories, item?.categoryId],
  );

  const save = async () => {
    if (disabled) return;
    if (variantsHaveIssues) {
      setShowIssues(true);
      return;
    }
    setSaving(true);
    let persistedItem: Item | null = null;
    let createdItem = false;
    try {
      const serviceDefinition =
        type === 'SERVICE' ? { defaultDurationMinutes: parsedDefaultDuration } : undefined;
      const baseInput = {
        ...(hasVariants ? { variantSelectionMode } : {}),
        name: name.trim(),
        categoryId,
        description: description.trim() || null,
        lifecycle,
        fulfillmentBehavior: type === 'SERVICE' ? ('TRACKED' as const) : ('INSTANT' as const),
        ...(serviceDefinition ? { serviceDefinition } : {}),
      };
      const effectiveFrom = new Date().toISOString();
      const createdVariantIds = new Map<string, string>();

      if (fresh) {
        persistedItem = await api.createItem({
          ...baseInput,
          ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
          type,
        });
        createdItem = true;
        if (canCreateVariants)
          for (const draft of variants) {
            const created = await api.createVariant(persistedItem.id, {
              ...(draft.code.trim() ? { code: draft.code.trim().toUpperCase() } : {}),
              name: draft.name.trim(),
              status: 'ACTIVE',
            });
            createdVariantIds.set(draft.key, created.id);
          }
        if (canCreatePricing && sellsItemItself(model) && defaultPrice.trim())
          await api.createPrice({
            catalogItemId: persistedItem.id,
            catalogVariantId: null,
            locationId: null,
            currency,
            amount: defaultPrice.trim(),
            effectiveFrom,
          });
      } else if (item) {
        persistedItem = await api.updateItem(item, baseInput);
        const nextPrice = defaultPrice.trim();
        const initialPrice = initialPriceRef.current ?? null;
        if (
          canEditPrice &&
          sellsItemItself(model) &&
          nextPrice &&
          !(initialPrice && sameAmount(nextPrice, initialPrice))
        ) {
          const input = {
            catalogItemId: item.id,
            catalogVariantId: null,
            locationId: null,
            currency,
            amount: nextPrice,
            effectiveFrom,
          };
          await (initialPrice ? api.changePrice(input) : api.createPrice(input));
        }
      }

      // Every variant price, new or changed, is persisted as its own explicit Runtime price.
      if (persistedItem && canEditPrice)
        for (const submission of variantPriceSubmissions(variants, createdVariantIds))
          await api.changeVariantPrices({
            catalogItemId: persistedItem.id,
            catalogVariantIds: submission.catalogVariantIds,
            currency,
            amount: submission.amount,
            effectiveFrom,
          });

      if (persistedItem && canManageImage) {
        if (selectedImage) {
          await api.replaceItemImage(persistedItem.id, selectedImage);
          void client.invalidateQueries({ queryKey: ['catalog', 'image', persistedItem.id] });
        } else if (removeImageRequested && existingImage.data) {
          await api.removeItemImage(persistedItem.id);
          void client.invalidateQueries({ queryKey: ['catalog', 'image', persistedItem.id] });
        }
      }

      refreshPricingViews();
      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? 'Item berhasil ditambahkan.' : 'Item berhasil diperbarui.',
      });
      onClose();
    } catch (error) {
      if (persistedItem) {
        refreshPricingViews();
        onSaved();
        showToast({
          variant: 'danger',
          title: createdItem
            ? 'Item tersimpan, tetapi pengaturan awal belum lengkap.'
            : 'Item tersimpan, tetapi harga, gambar, atau pengaturan terkait belum selesai diperbarui.',
        });
        onClose();
      } else if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Item tidak dapat disimpan.').safeMessage,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  function refreshPricingViews() {
    for (const key of ['prices', 'variants', 'variant-price', 'edit-price', 'edit-variant-price'])
      void client.invalidateQueries({ queryKey: ['catalog', key] });
  }

  return (
    <DDialog
      open={item !== undefined}
      onClose={onClose}
      size="xl"
      title={fresh ? 'Tambah Item' : 'Edit Item'}
      description={
        fresh
          ? 'Isi informasi item, lalu tentukan cara penjualan dan harganya.'
          : 'Perbarui informasi, cara penjualan, dan harga.'
      }
      footer={<DialogFooter onClose={onClose} onSave={() => void save()} disabled={disabled} />}
    >
      {item ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-(--color-surface-muted) px-3 py-2.5">
          <CatalogItemThumbnail api={api} itemId={item.id} itemName={item.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.name}</p>
            <p className="truncate text-xs text-(--color-text-muted)">
              {item.code} · {item.type === 'SERVICE' ? 'Jasa' : 'Produk'}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {canViewPricing && !variantPricesLoading ? (
              <SellingModelBadge model={sellingModel(hasVariants, item.variantSelectionMode)} />
            ) : null}
            <Status value={item.lifecycle} />
          </div>
        </div>
      ) : null}
      <div className="divide-y divide-(--color-border)">
        <CatalogSection
          title="Informasi item"
          description="Nama dan klasifikasi yang tampil di katalog dan kasir."
        >
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            {canManageImage ? (
              <CatalogItemImageField
                itemName={name}
                existingImage={existingImage.data}
                selectedFile={selectedImage}
                removeRequested={removeImageRequested}
                disabled={saving}
                onFileChange={(file) => {
                  setSelectedImage(file);
                  if (file) setRemoveImageRequested(false);
                }}
                onRemove={() => setRemoveImageRequested(true)}
              />
            ) : null}
            <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <DInput
                  label="Nama Item"
                  value={name}
                  onChange={setName}
                  placeholder="Contoh: Coffee Latte"
                />
              </div>
              <DInput
                label="Kode Item"
                value={code}
                onChange={setCode}
                disabled={!fresh}
                hint={
                  fresh
                    ? 'Kosongkan untuk membuat kode otomatis.'
                    : 'Kode tidak dapat diubah setelah dibuat.'
                }
              />
              <DSelect
                label="Tipe"
                value={type}
                onChange={(value) => setType(value as Item['type'])}
                disabled={!fresh}
                options={[
                  { label: 'Produk', value: 'PRODUCT' },
                  { label: 'Jasa', value: 'SERVICE' },
                ]}
              />
              <DSelect
                label="Kategori"
                value={categoryId}
                onChange={(value) => setCategoryId(value as string | null)}
                clearable
                options={categoryOptions.map((category) => ({
                  label:
                    category.status === 'ACTIVE' ? category.name : `${category.name} · Nonaktif`,
                  value: category.id,
                }))}
              />
              <DSelect
                label="Status"
                value={lifecycle}
                onChange={(value) => setLifecycle(value as Item['lifecycle'])}
                options={[
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Aktif', value: 'ACTIVE' },
                  { label: 'Nonaktif', value: 'INACTIVE' },
                ]}
              />
              <div className="sm:col-span-2">
                <DTextarea
                  label="Deskripsi"
                  value={description}
                  onChange={setDescription}
                  placeholder="Deskripsi item (opsional)"
                  className="min-h-20"
                />
              </div>
            </div>
          </div>
        </CatalogSection>

        {type === 'SERVICE' ? (
          <CatalogSection title="Pengaturan layanan" tone="secondary">
            <div className="max-w-xs">
              <DInput
                label="Durasi Layanan (menit)"
                hint="Opsional."
                value={defaultDurationMinutes}
                onChange={setDefaultDurationMinutes}
                type="number"
                min={1}
                placeholder="30"
                error={
                  validDefaultDuration ? undefined : 'Durasi harus berupa angka bulat positif.'
                }
              />
            </div>
          </CatalogSection>
        ) : null}

        {showPrice ? (
          <CatalogSection
            title="Penjualan & harga"
            description={
              hasVariants
                ? 'Tentukan apakah item juga bisa dijual tanpa memilih varian.'
                : sellingModelCopy.DIRECT.description
            }
            actions={hasVariants ? <SellingModelBadge model={model} /> : undefined}
          >
            <div className="space-y-4">
              {hasVariants ? (
                <SellingModeChoice
                  value={variantSelectionMode}
                  onChange={setVariantSelectionMode}
                  disabled={!canEditPrice || saving}
                />
              ) : null}

              {sellsItemItself(model) ? (
                <div
                  className={
                    hasVariants
                      ? 'flex flex-col gap-3 rounded-xl border border-(--color-border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
                      : ''
                  }
                >
                  {hasVariants ? (
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Tanpa varian</p>
                      <p className="text-xs text-(--color-text-muted)">
                        Pilihan jual tersendiri, dengan harganya sendiri.
                      </p>
                    </div>
                  ) : null}
                  <div className="w-full sm:max-w-xs">
                    {canEditPrice ? (
                      <DCurrencyInput
                        label={`${hasVariants ? 'Harga tanpa varian' : 'Harga jual'} (${currency})`}
                        value={defaultPrice}
                        onValueChange={setDefaultPrice}
                        placeholder="Contoh: 100000"
                        error={itemPriceError}
                        hint={
                          !fresh && currentPrice.isLoading ? 'Memuat harga saat ini...' : undefined
                        }
                      />
                    ) : (
                      <div>
                        <p className="text-xs text-(--color-text-muted)">
                          {hasVariants ? 'Harga tanpa varian' : 'Harga jual'}
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {defaultPrice ? formatMoney(defaultPrice, currency) : 'Belum diatur'}
                        </p>
                        <p className="mt-1 text-xs text-(--color-text-muted)">
                          Anda tidak memiliki akses untuk mengubah harga.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-(--color-text-muted)">
                  Harga ditentukan oleh setiap varian di bawah.
                  {storedItemPrice
                    ? ` Harga item ${formatMoney(storedItemPrice, currency)} tetap tersimpan di riwayat, tetapi tidak dijual.`
                    : ''}
                </p>
              )}
            </div>
          </CatalogSection>
        ) : null}

        {showVariants || (!fresh && canViewPricing && variantPricesLoading) ? (
          <CatalogSection
            title="Varian"
            count={variants.length}
            description={
              fresh
                ? 'Opsional. Setiap varian dijual dengan harga finalnya sendiri.'
                : `Setiap varian dijual dengan harga finalnya sendiri. Tambah atau nonaktifkan varian dari detail item.${
                    inactiveVariantCount
                      ? ` ${inactiveVariantCount} varian nonaktif tidak ditampilkan.`
                      : ''
                  }`
            }
          >
            {variantPricesLoading && !fresh ? (
              <p className="text-sm text-(--color-text-muted)">Memuat varian...</p>
            ) : (
              <VariantPriceEditor
                drafts={variants}
                onChange={setVariants}
                currency={currency}
                canPrice={canEditPrice}
                canAddVariants={fresh && canCreateVariants}
                seed={
                  sellsItemItself(model) && hasVariants
                    ? { label: 'Pakai harga tanpa varian', amount: defaultPrice }
                    : null
                }
                showIssues={showIssues}
              />
            )}
          </CatalogSection>
        ) : null}

        {fresh && hasVariants && canEditPrice ? (
          <CatalogSection
            title="Akan disimpan"
            tone="secondary"
            description={sellingModelCopy[model].description}
          >
            <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              {sellsItemItself(model) ? (
                <div className="flex justify-between gap-3 border-b border-(--color-border) pb-2 sm:col-span-2">
                  <dt className="text-(--color-text-muted)">Tanpa varian</dt>
                  <dd
                    className={`font-medium tabular-nums ${
                      isValidSellingPrice(defaultPrice) ? '' : 'text-(--color-danger)'
                    }`}
                  >
                    {isValidSellingPrice(defaultPrice)
                      ? formatMoney(defaultPrice.trim(), currency)
                      : 'Belum ada harga'}
                  </dd>
                </div>
              ) : null}
              {variants.map((draft, index) => (
                <div key={draft.key} className="flex justify-between gap-3">
                  <dt className="truncate text-(--color-text-muted)">
                    {draft.name.trim() || `Varian ${index + 1}`}
                  </dt>
                  <dd
                    className={`font-medium tabular-nums ${
                      isValidSellingPrice(draft.price) ? '' : 'text-(--color-danger)'
                    }`}
                  >
                    {isValidSellingPrice(draft.price)
                      ? formatMoney(draft.price.trim(), currency)
                      : 'Belum ada harga'}
                  </dd>
                </div>
              ))}
            </dl>
          </CatalogSection>
        ) : null}
      </div>
    </DDialog>
  );
}
