import {
  DButton,
  DCheckbox,
  DCurrencyInput,
  DDialog,
  DInput,
  DSelect,
  DTextarea,
  useToast,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type {
  CatalogApi,
  Category,
  Item,
  TaxCategory,
  TaxProfile,
} from './catalog-api';
import { CatalogItemImageField } from './catalog-item-image-field';
import { useCatalogLocalization } from './catalog-localization';
import { DialogFooter } from './catalog-shared';

type DraftVariant = {
  key: string;
  code: string;
  name: string;
  price: string;
};

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
  canCreatePricing: boolean;
  canCreateVariants: boolean;
  canManageImage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fresh = item === null;
  const { showToast } = useToast();
  const { copy } = useCatalogLocalization();
  const [code, setCode] = useState(item?.code ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<Item['type']>(item?.type ?? 'PRODUCT');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? null);
  const [taxCategoryId, setTaxCategoryId] = useState(item?.taxCategoryId ?? null);
  const [description, setDescription] = useState(item?.description ?? '');
  const [lifecycle, setLifecycle] = useState<Item['lifecycle']>(item?.lifecycle ?? 'DRAFT');
  const [fulfillmentBehavior, setFulfillmentBehavior] = useState<Item['fulfillmentBehavior']>(
    item?.fulfillmentBehavior ?? 'INSTANT',
  );
  const [defaultPrice, setDefaultPrice] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    item?.serviceDefinition?.defaultDurationMinutes?.toString() ?? '',
  );
  const [employeeAssignmentMode, setEmployeeAssignmentMode] = useState<
    NonNullable<Item['serviceDefinition']>['employeeAssignmentMode']
  >(item?.serviceDefinition?.employeeAssignmentMode ?? 'NONE');
  const [allowEmployeeContribution, setAllowEmployeeContribution] = useState(
    item?.serviceDefinition?.allowEmployeeContribution ?? false,
  );
  const [saving, setSaving] = useState(false);

  const existingImage = useQuery({
    queryKey: ['catalog', 'image', item?.id ?? 'new'],
    queryFn: () => api.getItemImage(item!.id),
    enabled: Boolean(item),
    staleTime: 60_000,
  });

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

  const activeCategories = useMemo(
    () => categories.filter((category) => category.status === 'ACTIVE'),
    [categories],
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
              employeeAssignmentMode,
              allowEmployeeContribution,
            }
          : undefined;
      const baseInput = {
        name: name.trim(),
        categoryId,
        description: description.trim() || null,
        lifecycle,
        fulfillmentBehavior,
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
      }

      if (persistedItem && canManageImage) {
        if (selectedImage) {
          await api.replaceItemImage(persistedItem.id, selectedImage);
        } else if (removeImageRequested && existingImage.data) {
          await api.removeItemImage(persistedItem.id);
        }
      }

      onSaved();
      showToast({
        variant: 'success',
        title: fresh ? copy('Item added.') : copy('Item updated.'),
      });
      onClose();
    } catch (error) {
      if (persistedItem) {
        onSaved();
        showToast({
          variant: 'danger',
          title: createdItem
            ? copy('Item created, but its initial setup is incomplete.')
            : copy('Item was saved, but its image or related setup could not be completed.'),
        });
        onClose();
      } else if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save item.')).safeMessage,
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
      title={(fresh ? copy('Add') : copy('Edit')) + ' ' + copy('Item')}
      description={
        fresh
          ? copy('Complete the essentials first. Pricing and variants can be prepared in the same flow.')
          : copy('Update item identity, tax assignment, and service behavior.')
      }
      footer={
        <DialogFooter onClose={onClose} onSave={() => void save()} disabled={disabled} />
      }
    >
      <div className="space-y-5">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">{copy('Basic information')}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy('Identity and selling behavior for this catalog item.')}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DInput
              label={copy('Item code')}
              hint={fresh ? copy('Leave blank to generate a code automatically.') : copy('Code cannot be changed after creation.')}
              value={code}
              onChange={setCode}
              disabled={!fresh}
              placeholder="COFFEE_LATTE"
            />
            <DInput label={copy('Item name')} value={name} onChange={setName} placeholder={copy('For example, Coffee Latte')} />
            <DSelect
              label={copy('Type')}
              value={type}
              onChange={(value) => setType(value as Item['type'])}
              disabled={!fresh}
              options={[
                { label: copy('Product'), value: 'PRODUCT' },
                { label: copy('Service'), value: 'SERVICE' },
              ]}
            />
            <DSelect
              label={copy('Status')}
              value={lifecycle}
              onChange={(value) => setLifecycle(value as Item['lifecycle'])}
              options={[
                { label: copy('Draft'), value: 'DRAFT' },
                { label: copy('Active'), value: 'ACTIVE' },
                { label: copy('Inactive'), value: 'INACTIVE' },
              ]}
            />
            <DSelect
              label={copy('Category')}
              value={categoryId}
              onChange={(value) => setCategoryId(value as string | null)}
              clearable
              options={activeCategories.map((category) => ({ label: category.name, value: category.id }))}
            />
            <DSelect
              label={copy('Fulfillment')}
              value={fulfillmentBehavior}
              onChange={(value) => setFulfillmentBehavior(value as Item['fulfillmentBehavior'])}
              options={[
                { label: copy('Instant'), value: 'INSTANT' },
                { label: copy('Tracked'), value: 'TRACKED' },
              ]}
            />
          </div>
          <div className="mt-4">
            <DTextarea
              label={copy('Description')}
              value={description}
              onChange={setDescription}
              placeholder={copy('Add an optional description for this item')}
              className="min-h-24"
            />
          </div>
        </section>

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

        {canViewTax || (fresh && canCreatePricing) ? (
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
            <h2 className="text-sm font-semibold">{copy('Pricing & tax')}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              {copy('Set the starting price and item-specific tax behavior without leaving item creation.')}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {fresh && canCreatePricing ? (
                <div>
                  <DCurrencyInput
                    label={`${copy('Default Price')} (${currency})`}
                    value={defaultPrice}
                    onValueChange={setDefaultPrice}
                    placeholder={copy('For example, 100000')}
                  />
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    {copy('Optional. Variant prices inherit this price unless an override is provided.')}
                  </p>
                </div>
              ) : null}
              {canViewTax ? (
                <div>
                  <DSelect
                    label={copy('Item tax category')}
                    value={taxCategoryId}
                    onChange={(value) => setTaxCategoryId(value as string | null)}
                    clearable
                    options={availableTaxCategories.map((category) => ({
                      label: category.status === 'ACTIVE' ? category.name : `${category.name} · ${copy('Inactive')}`,
                      value: category.id,
                    }))}
                  />
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                    {taxProfile?.itemTaxEnabled
                      ? copy('Leave empty when this item has no item-specific tax. Transaction tax may still apply.')
                      : copy('Item tax is currently disabled in Tax settings. The category can still be prepared here.')}
                  </p>
                </div>
              ) : null}
            </div>
            {!validPrice ? <p className="mt-2 text-sm text-[var(--color-danger)]">{copy('Price must be greater than zero with up to four decimal places.')}</p> : null}
          </section>
        ) : null}

        {type === 'SERVICE' ? (
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
            <h2 className="text-sm font-semibold">{copy('Service configuration')}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{copy('Define how this service is staffed and fulfilled.')}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DInput
                label={copy('Default duration')}
                hint={copy('Optional, in minutes.')}
                value={defaultDurationMinutes}
                onChange={setDefaultDurationMinutes}
                type="number"
                min={1}
                placeholder="30"
              />
              <DSelect
                label={copy('Employee assignment')}
                value={employeeAssignmentMode}
                onChange={(value) => setEmployeeAssignmentMode(value as NonNullable<Item['serviceDefinition']>['employeeAssignmentMode'])}
                options={[
                  { label: copy('None'), value: 'NONE' },
                  { label: copy('Optional'), value: 'OPTIONAL' },
                  { label: copy('Required'), value: 'REQUIRED' },
                ]}
              />
            </div>
            {!validDefaultDuration ? <p className="mt-2 text-sm text-[var(--color-danger)]">{copy('Default duration must be a positive whole number.')}</p> : null}
            <label className="mt-4 flex items-center gap-2 text-sm">
              <DCheckbox checked={allowEmployeeContribution} onChange={(event) => setAllowEmployeeContribution(event.target.checked)} />
              {copy('Allow employee contribution')}
            </label>
          </section>
        ) : null}

        {fresh && canCreateVariants ? (
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{copy('Initial variants')}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  {copy('Optional. Add the variants you already know now; more can be added from item details later.')}
                </p>
              </div>
              <DButton variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => setVariants((current) => [...current, draftVariant()])}>
                {copy('Add variant')}
              </DButton>
            </div>
            {variants.length ? (
              <div className="mt-4 space-y-3">
                {variants.map((variant, index) => (
                  <div key={variant.key} className="grid gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_auto]">
                    <DInput label={`${copy('Code')} ${index + 1}`} value={variant.code} onChange={(value) => updateVariant(variant.key, { code: value })} placeholder={copy('Optional')} />
                    <DInput label={copy('Variant name')} value={variant.name} onChange={(value) => updateVariant(variant.key, { name: value })} placeholder={copy('For example, Large')} />
                    {canCreatePricing ? (
                      <DCurrencyInput label={`${copy('Price')} (${currency})`} value={variant.price} onValueChange={(value) => updateVariant(variant.key, { price: value })} placeholder={copy('Uses default price')} />
                    ) : <div />}
                    <div className="flex items-end">
                      <DButton variant="secondary" onClick={() => setVariants((current) => current.filter((candidate) => candidate.key !== variant.key))}>
                        <span className="inline-flex items-center gap-1.5">
                          <Trash2 aria-hidden="true" className="size-4" />
                          <span className="hidden lg:inline">{copy('Remove variant')}</span>
                        </span>
                      </DButton>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--color-surface-muted)] px-4 py-3 text-xs text-[var(--color-text-muted)]">{copy('No initial variants. The item will use its default price directly.')}</p>
            )}
            {invalidVariant ? <p className="mt-2 text-sm text-[var(--color-danger)]">{copy('Each configured variant needs a name and any entered price must be valid.')}</p> : null}
          </section>
        ) : null}
      </div>
    </DDialog>
  );
}
