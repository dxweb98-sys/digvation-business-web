import { DBadge, DDialog } from '@digvation/ui';
import { BadgeDollarSign } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useCatalogItemEditorData } from '../api/use-catalog-item-editor-data';
import { useCatalogItemEditorSave } from '../api/use-catalog-item-editor-save';
import { deriveCatalogItemEditorValidation } from '../model/catalog-item-editor-validation';
import { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import type { LoyaltyApi } from '../../../../modules/loyalty/loyalty-api';
import type { CatalogApi, Category, Item } from '../../api/catalog-api';
import { CatalogItemAdditionalInfoSection } from './catalog-item-additional-info-section';
import { CatalogItemInformationSection } from './catalog-item-information-section';
import { CatalogItemPricingSection } from './catalog-item-pricing-section';
import { CatalogItemSaveSummarySection } from './catalog-item-save-summary-section';
import { CatalogItemVariantsSection } from './catalog-item-variants-section';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';
import { variantPriceState } from '../../model/catalog-price-history';
import {
  CatalogPanel,
  CatalogPanelHeader,
  DialogFooter,
  Status,
} from '../../ui/catalog-shared';
import { editableAmount } from '../model/variant-price-draft';

export function CatalogItemDialog({
  item,
  categories,
  currency,
  api,
  loyaltyApi,
  canViewLoyalty,
  canConfigureLoyalty,
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
  loyaltyApi: LoyaltyApi;
  canViewLoyalty: boolean;
  canConfigureLoyalty: boolean;
  canViewPricing: boolean;
  canCreatePricing: boolean;
  canCreateVariants: boolean;
  canManageImage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fresh = item === null;
  const { formatMoney } = useCatalogLocalization();
  const editor = useCatalogItemEditor(item);

  const { name } = editor.form;
  const { touched: loyaltyTouched, behavior: loyaltyBehavior } = editor.loyalty;
  const { showIssues, saving } = editor.ui;
  const {
    hydrateDefaultPriceOnce,
    hydrateVariantsOnce,
    hydrateLoyaltyOnce,
  } = editor.actions;
  const effectiveAt = editor.effectiveAt;

  const {
    existingImage,
    currentPrice,
    existingVariants,
    activeVariants,
    variantPrices,
    variantPricesLoading,
    loyaltyConfiguration,
    loyaltyRules,
    loyaltyRule,
  } = useCatalogItemEditorData({
    item,
    currency,
    effectiveAt,
    api,
    loyaltyApi,
    canViewPricing,
    canViewLoyalty,
  });

  useEffect(() => {
    if (!item || !canViewLoyalty || loyaltyRules.isLoading) return;

    hydrateLoyaltyOnce(
      loyaltyRule?.behavior ?? 'FIXED',
      loyaltyRule ? String(loyaltyRule.fixedPointsPerUnit) : '',
    );
  }, [canViewLoyalty, hydrateLoyaltyOnce, item, loyaltyRule, loyaltyRules.isLoading]);

  useEffect(() => {
    if (fresh || currentPrice.isLoading) return;

    const amount = currentPrice.data?.items[0]?.amount ?? null;
    hydrateDefaultPriceOnce(amount, amount ? editableAmount(amount) : '');
  }, [currentPrice.data, currentPrice.isLoading, fresh, hydrateDefaultPriceOnce]);

  useEffect(() => {
    if (fresh || variantPricesLoading || !existingVariants.data) return;

    hydrateVariantsOnce(
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
    // Drafts intentionally hydrate once per editor identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, variantPricesLoading, existingVariants.data, hydrateVariantsOnce]);

  const canEditPrice = fresh ? canCreatePricing : canViewPricing && canCreatePricing;
  const {
    parsedDefaultDuration,
    validDefaultDuration,
    hasVariants,
    model,
    itemPriceMissing,
    validPrice,
    variantsHaveIssues,
    loyaltyPoints,
    loyaltyDraftValid,
  } = deriveCatalogItemEditorValidation({
    form: editor.form,
    loyalty: editor.loyalty,
    canEditPrice,
  });
  const storedItemPrice = fresh ? null : (currentPrice.data?.items[0]?.amount ?? null);
  const itemPriceError = !validPrice
    ? 'Harga harus lebih dari nol.'
    : showIssues && itemPriceMissing
      ? 'Isi harga tanpa varian.'
      : undefined;
  const showPrice = canViewPricing || (fresh && canCreatePricing);
  const showSellingSection =
    showPrice ||
    canCreateVariants ||
    (!fresh && canViewPricing && (hasVariants || variantPricesLoading));
  const inactiveVariantCount = (existingVariants.data?.items ?? []).length - activeVariants.length;
  const loyaltyDraftChanged = loyaltyRule
    ? loyaltyBehavior !== loyaltyRule.behavior || loyaltyPoints !== loyaltyRule.fixedPointsPerUnit
    : loyaltyTouched;
  const shouldSaveLoyalty =
    !fresh && canConfigureLoyalty && loyaltyTouched && loyaltyDraftValid && loyaltyDraftChanged;
  const disabled =
    !name.trim() ||
    !validDefaultDuration ||
    !validPrice ||
    (canConfigureLoyalty && loyaltyTouched && !loyaltyDraftValid) ||
    saving;

  const categoryOptions = useMemo(
    () =>
      categories.filter(
        (category) => category.status === 'ACTIVE' || category.id === item?.categoryId,
      ),
    [categories, item?.categoryId],
  );

  const save = useCatalogItemEditorSave({
    item,
    editor,
    api,
    loyaltyApi,
    loyaltyRule,
    currency,
    model,
    parsedDefaultDuration,
    canCreateVariants,
    canCreatePricing,
    canEditPrice,
    canManageImage,
    shouldSaveLoyalty,
    loyaltyPoints,
    existingImagePresent: Boolean(existingImage.data),
    disabled,
    variantsHaveIssues,
    onSaved,
    onClose,
  });

  return (
    <DDialog
      open={item !== undefined}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
          <span>{fresh ? 'Tambah Item' : 'Edit Item'}</span>
          {!fresh && item ? (
            <>
              <DBadge variant="info">{item.code}</DBadge>
              <Status value={item.lifecycle} />
            </>
          ) : null}
        </div>
      }
      footer={<DialogFooter onClose={onClose} onSave={() => void save()} disabled={disabled} />}
    >
      <div className="space-y-5">
        <CatalogItemInformationSection
          editor={editor}
          fresh={fresh}
          categoryOptions={categoryOptions}
          canManageImage={canManageImage}
          existingImage={existingImage.data}
          model={model}
          currency={currency}
          showPricing={showPrice}
          canEditPrice={canEditPrice}
          currentPriceLoading={currentPrice.isLoading}
          itemPriceError={itemPriceError}
          storedItemPrice={storedItemPrice}
          formatMoney={formatMoney}
        />

        {showSellingSection ? (
          <CatalogPanel ariaLabel="Penjualan & Penentuan Harga">
            <CatalogPanelHeader
              title="Penjualan & Penentuan Harga"
              icon={<BadgeDollarSign className="size-4" aria-hidden="true" />}
              description="Atur cara item dijual, harga default, dan varian dalam satu tempat."
              actions={hasVariants ? <DBadge variant="info">Mode Varian</DBadge> : undefined}
            />
            <div className="p-5">
              {showPrice ? (
                <CatalogItemPricingSection
                  editor={editor}
                  canEditPrice={canEditPrice}
                />
              ) : null}

              <CatalogItemVariantsSection
                editor={editor}
                model={model}
                currency={currency}
                fresh={fresh}
                canViewPricing={canViewPricing}
                canEditPrice={canEditPrice}
                canCreateVariants={canCreateVariants}
                variantPricesLoading={variantPricesLoading}
                inactiveVariantCount={inactiveVariantCount}
              />
            </div>
          </CatalogPanel>
        ) : null}

        <CatalogItemAdditionalInfoSection
          editor={editor}
          fresh={fresh}
          categoryOptions={categoryOptions}
          validDefaultDuration={validDefaultDuration}
          model={model}
          canViewLoyalty={canViewLoyalty}
          loyaltyRule={loyaltyRule}
          loyaltyConfiguration={loyaltyConfiguration.data}
          loyaltyLoading={loyaltyRules.isLoading || loyaltyConfiguration.isLoading}
          canConfigureLoyalty={canConfigureLoyalty}
          loyaltyDraftValid={loyaltyDraftValid}
        />

        {fresh && hasVariants && canEditPrice ? (
          <CatalogItemSaveSummarySection
            editor={editor}
            model={model}
            currency={currency}
            formatMoney={formatMoney}
          />
        ) : null}
      </div>
    </DDialog>
  );
}
