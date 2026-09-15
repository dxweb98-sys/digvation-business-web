import {
  DButton,
  DCurrencyInput,
  DDialog,
  DInput,
  DSelect,
  DTextarea,
  useToast,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { CatalogApi, Category, Item, TaxCategory, TaxProfile } from './catalog-api';
import { CatalogItemImageField } from './catalog-item-image-field';
import { DialogFooter } from './catalog-shared';

type DraftVariant = { key: string; code: string; name: string; price: string };

const draftVariant = (): DraftVariant => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  code: '',
  name: '',
  price: '',
});

function validOptionalMoney(value: string) {
  const normalized = value.trim();
  if (!normalized) return true;
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return false;
  return !/^0+(?:\.0{1,4})?$/.test(normalized);
}

export function CatalogItemDialog({
  item,
  categories,
  taxCategories,
  taxProfile,
  currency,
  api,
  canViewTax,
  canViewPricing,
  canCreatePricing,
  canCreateVariants,
  canManageImage,
  onClose,
  onSaved,
}: {
  item: Item | null | undefined;
  categories: Category[];
  taxCategories: TaxCategory[];
  taxProfile?: TaxProfile;
  currency: string;
  api: CatalogApi;
  canViewTax: boolean;
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
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<Item['type']>(item?.type ?? 'PRODUCT');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? null);
  const [taxCategoryId, setTaxCategoryId] = useState(item?.taxCategoryId ?? null);
  const [description, setDescription] = useState(item?.description ?? '');
  const [lifecycle, setLifecycle] = useState<Item['lifecycle']>(item?.lifecycle ?? 'DRAFT');
  const [defaultPrice, setDefaultPrice] = useState('');
  const initialPriceRef = useRef<string | null | undefined>(undefined);
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    item?.serviceDefinition?.defaultDurationMinutes?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);

  const existingImage = useQuery({
    queryKey: ['catalog', 'image', item?.id ?? 'new'],
    queryFn: () => api.getItemImage(item!.id),
    enabled: Boolean(item),
    staleTime: 60_000,
  });
  const currentPrice = useQuery({
    queryKey: ['catalog', 'edit-price', item?.id ?? 'new', currency],
    queryFn: () => api.listDefaultPrices([item!.id], currency, new Date().toISOString()),
    enabled: Boolean(item && canViewPricing),
  });

  useEffect(() => {
    if (fresh || initialPriceRef.current !== undefined || currentPrice.isLoading) return;
    const amount = currentPrice.data?.items[0]?.amount ?? null;
    initialPriceRef.current = amount;
    setDefaultPrice(amount ?? '');
  }, [currentPrice.data, currentPrice.isLoading, fresh]);

  const parsedDefaultDuration = defaultDurationMinutes.trim()
    ? Number(defaultDurationMinutes)
    : null;
  const validDefaultDuration =
    parsedDefaultDuration === null ||
    (Number.isInteger(parsedDefaultDuration) && parsedDefaultDuration > 0);
  const invalidVariant = variants.some(
    (variant) =>
      (!variant.name.trim() && Boolean(variant.code.trim() || variant.price.trim())) ||
      !validOptionalMoney(variant.price),
  );
  const validPrice = validOptionalMoney(defaultPrice);
  const disabled = !name.trim() || !validDefaultDuration || !validPrice || invalidVariant || saving;
  const showPrice = canViewPricing || (fresh && canCreatePricing);
  const canEditPrice = fresh ? canCreatePricing : canViewPricing && canCreatePricing;

  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.status === 'ACTIVE' || category.id === item?.categoryId,
      ),
    [categories, item?.categoryId],
  );
  const availableTaxCategories = useMemo(
    () =>
      taxCategories.filter(
        (category) => category.status === 'ACTIVE' || category.id === item?.taxCategoryId,
      ),
    [item?.taxCategoryId, taxCategories],
  );

  const updateVariant = (key: string, change: Partial<DraftVariant>) =>
    setVariants((current) =>
      current.map((variant) => (variant.key === key ? { ...variant, ...change } : variant)),
    );

  const save = async () => {
    if (disabled) return;
    setSaving(true);
    let persistedItem: Item | null = null;
    let createdItem = false;
    try {
      const serviceDefinition =
        type === 'SERVICE'
          ? {
              defaultDurationMinutes: parsedDefaultDuration,
            }
          : undefined;
      const baseInput = {
        name: name.trim(),
        categoryId,
        description: description.trim() || null,
        lifecycle,
        fulfillmentBehavior: type === 'SERVICE' ? ('TRACKED' as const) : ('INSTANT' as const),
        ...(serviceDefinition ? { serviceDefinition } : {}),
      };

      if (fresh) {
        persistedItem = await api.createItem({
          ...baseInput,
          ...(code.trim() ? { code: code.trim().toUpperCase() } : {}),
          type,
          ...(canViewTax ? { taxCategoryId } : {}),
        });
        createdItem = true;

        const createdVariants: Array<{ id: string; draft: DraftVariant }> = [];
        if (canCreateVariants) {
          for (const variant of variants.filter((candidate) => candidate.name.trim())) {
            const created = await api.createVariant(persistedItem.id, {
              ...(variant.code.trim() ? { code: variant.code.trim().toUpperCase() } : {}),
              name: variant.name.trim(),
              status: 'ACTIVE',
            });
            createdVariants.push({ id: created.id, draft: variant });
          }
        }

        if (canCreatePricing) {
          const effectiveFrom = new Date().toISOString();
          if (defaultPrice.trim()) {
            await api.createPrice({
              catalogItemId: persistedItem.id,
              catalogVariantId: null,
              locationId: null,
              currency,
              amount: defaultPrice.trim(),
              effectiveFrom,
            });
          }
          for (const variant of createdVariants) {
            if (!variant.draft.price.trim()) continue;
            await api.createPrice({
              catalogItemId: persistedItem.id,
              catalogVariantId: variant.id,
              locationId: null,
              currency,
              amount: variant.draft.price.trim(),
              effectiveFrom,
            });
          }
        }
      } else if (item) {
        persistedItem = await api.updateItem(item, {
          ...baseInput,
          ...(canViewTax && taxCategoryId !== item.taxCategoryId ? { taxCategoryId } : {}),
        });

        const nextPrice = defaultPrice.trim();
        const initialPrice = initialPriceRef.current ?? null;
        if (canEditPrice && nextPrice && nextPrice !== initialPrice) {
          const effectiveFrom = new Date().toISOString();
          if (initialPrice) {
            await api.changePrice({
              catalogItemId: item.id,
              catalogVariantId: null,
              locationId: null,
              currency,
              amount: nextPrice,
              effectiveFrom,
            });
          } else {
            await api.createPrice({
              catalogItemId: item.id,
              catalogVariantId: null,
              locationId: null,
              currency,
              amount: nextPrice,
              effectiveFrom,
            });
          }
        }
      }

      if (persistedItem && canManageImage) {
        if (selectedImage) {
          await api.replaceItemImage(persistedItem.id, selectedImage);
          void client.invalidateQueries({ queryKey: ['catalog', 'image', persistedItem.id] });
        } else if (removeImageRequested && existingImage.data) {
          await api.removeItemImage(persistedItem.id);
          void client.invalidateQueries({ queryKey: ['catalog', 'image', persistedItem.id] });
        }
      }

      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? 'Item berhasil ditambahkan.' : 'Item berhasil diperbarui.',
      });
      showToast({
        variant: 'success',
        title: fresh ? 'Item berhasil ditambahkan.' : 'Item berhasil diperbarui.',
      });
      onClose();
    } catch (error) {
      if (persistedItem) {
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

  return (
    <DDialog
      open={item !== undefined}
      onClose={onClose}
      size="xl"
      title={fresh ? 'Tambah Item' : 'Edit Item'}
      description={
        fresh
          ? 'Lengkapi informasi item, harga jual, dan pengaturan yang diperlukan.'
          : 'Ubah informasi item dan harga jual dalam satu langkah.'
      }
      footer={<DialogFooter onClose={onClose} onSave={() => void save()} disabled={disabled} />}
    >
      <div className="space-y-5">
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

        <section className="border-b border-(--color-border) pb-5">
          <h2 className="text-sm font-semibold">Informasi Item</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <DInput
              label="Nama Item"
              value={name}
              onChange={setName}
              placeholder="Contoh: Coffee Latte"
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
              label="Status"
              value={lifecycle}
              onChange={(value) => setLifecycle(value as Item['lifecycle'])}
              options={[
                { label: 'Draft', value: 'DRAFT' },
                { label: 'Aktif', value: 'ACTIVE' },
                { label: 'Nonaktif', value: 'INACTIVE' },
              ]}
            />
            <DSelect
              label="Kategori"
              value={categoryId}
              onChange={(value) => setCategoryId(value as string | null)}
              clearable
              options={categoryOptions.map((category) => ({
                label: category.status === 'ACTIVE' ? category.name : `${category.name} · Nonaktif`,
                value: category.id,
              }))}
            />
          </div>
          <div className="mt-4">
            <DTextarea
              label="Deskripsi"
              value={description}
              onChange={setDescription}
              placeholder="Deskripsi item (opsional)"
              className="min-h-24"
            />
          </div>
        </section>

        {showPrice || canViewTax ? (
          <section className="border-b border-(--color-border) pb-5">
            <h2 className="text-sm font-semibold">Harga & Pajak</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {showPrice ? (
                <div>
                  {canEditPrice ? (
                    <DCurrencyInput
                      label={`Harga Jual (${currency})`}
                      value={defaultPrice}
                      onValueChange={setDefaultPrice}
                      placeholder="Contoh: 100000"
                    />
                  ) : (
                    <DInput
                      label={`Harga Jual (${currency})`}
                      value={defaultPrice}
                      onChange={setDefaultPrice}
                      disabled
                    />
                  )}
                  {!fresh && currentPrice.isLoading ? (
                    <p className="mt-1 text-xs text-(--color-text-muted)">
                      Memuat harga saat ini...
                    </p>
                  ) : null}
                  {!validPrice ? (
                    <p className="mt-1 text-sm text-(--color-danger)">
                      Harga harus lebih dari nol.
                    </p>
                  ) : null}
                  {!canEditPrice && canViewPricing && !currentPrice.isLoading ? (
                    <p className="mt-1 text-xs text-(--color-text-muted)">
                      Anda tidak memiliki akses untuk mengubah harga.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {canViewTax ? (
                <div>
                  <DSelect
                    label="Kategori Pajak Item"
                    value={taxCategoryId}
                    onChange={(value) => setTaxCategoryId(value as string | null)}
                    clearable
                    options={availableTaxCategories.map((category) => ({
                      label:
                        category.status === 'ACTIVE'
                          ? category.name
                          : `${category.name} · Nonaktif`,
                      value: category.id,
                    }))}
                  />
                  <p className="mt-1 text-xs text-(--color-text-muted)">
                    {taxProfile?.itemTaxEnabled
                      ? 'Kosongkan jika item tidak memiliki pajak khusus.'
                      : 'Pajak item sedang dinonaktifkan di pengaturan pajak.'}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {type === 'SERVICE' ? (
          <section className="border-b border-(--color-border) pb-5">
            <h2 className="text-sm font-semibold">Jasa</h2>
            <div className="mt-4 max-w-sm">
              <DInput
                label="Durasi Layanan (menit)"
                hint="Opsional."
                value={defaultDurationMinutes}
                onChange={setDefaultDurationMinutes}
                type="number"
                min={1}
                placeholder="30"
              />
            </div>
            {!validDefaultDuration ? (
              <p className="mt-2 text-sm text-(--color-danger)">
                Durasi harus berupa angka bulat positif.
              </p>
            ) : null}
          </section>
        ) : null}

        {fresh && canCreateVariants ? (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Varian</h2>
                <p className="mt-1 text-xs text-(--color-text-muted)">
                  Tambahkan varian sekarang atau kelola nanti dari detail item.
                </p>
              </div>
              <DButton
                variant="secondary"
                leftIcon={<Plus className="size-4" />}
                onClick={() => setVariants((current) => [...current, draftVariant()])}
              >
                Tambah Varian
              </DButton>
            </div>
            {variants.length ? (
              <div className="mt-4 space-y-3">
                {variants.map((variant) => (
                  <div
                    key={variant.key}
                    className="grid gap-3 rounded-xl bg-(--color-surface-muted) p-3 md:grid-cols-[0.8fr_1.1fr_0.8fr_auto]"
                  >
                    <DInput
                      label="Kode"
                      value={variant.code}
                      onChange={(value) => updateVariant(variant.key, { code: value })}
                      placeholder="Opsional"
                    />
                    <DInput
                      label="Nama Varian"
                      value={variant.name}
                      onChange={(value) => updateVariant(variant.key, { name: value })}
                      placeholder="Contoh: Large"
                    />
                    {canCreatePricing ? (
                      <DCurrencyInput
                        label={`Harga (${currency})`}
                        value={variant.price}
                        onValueChange={(value) => updateVariant(variant.key, { price: value })}
                        placeholder="Mengikuti harga item"
                      />
                    ) : (
                      <div />
                    )}
                    <div className="flex items-end">
                      <DButton
                        variant="secondary"
                        onClick={() =>
                          setVariants((current) =>
                            current.filter((candidate) => candidate.key !== variant.key),
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </DButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {invalidVariant ? (
              <p className="mt-2 text-sm text-(--color-danger)">
                Setiap varian yang diisi harus memiliki nama dan harga yang valid.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </DDialog>
  );
}
