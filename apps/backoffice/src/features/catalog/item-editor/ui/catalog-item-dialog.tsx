import { DDialog } from '@digvation/ui';
import { useEffect, useMemo } from 'react';
import { useCatalogItemEditorData } from '../api/use-catalog-item-editor-data';
import { useCatalogItemEditorSave } from '../api/use-catalog-item-editor-save';
import { deriveCatalogItemEditorValidation } from '../model/catalog-item-editor-validation';
import { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import type { LoyaltyApi } from '../../../../modules/loyalty/loyalty-api';
import type { CatalogApi, Category, Item } from '../../api/catalog-api';
import { CatalogItemEditorHeader } from './catalog-item-editor-header';
import { CatalogItemInformationSection } from './catalog-item-information-section';
import { CatalogItemLoyaltySection } from './catalog-item-loyalty-section';
import { CatalogItemPricingSection } from './catalog-item-pricing-section';
import { CatalogItemSaveSummarySection } from './catalog-item-save-summary-section';
import { CatalogItemServiceSection } from './catalog-item-service-section';
import { CatalogItemVariantsSection } from './catalog-item-variants-section';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';
import { variantPriceState } from '../../model/catalog-price-history';
import { DialogFooter } from '../../ui/catalog-shared';
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

  const { name, type } = editor.form;
  const { touched: loyaltyTouched, behavior: loyaltyBehavior } = editor.loyalty;
  const { showIssues, saving } = editor.ui;
  const { initialPrice, variantsLoaded, loyaltyRuleLoaded } = editor.refs;
  const {
    hydrateDefaultPrice,
    hydrateVariants,
    hydrateLoyalty,
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
    if (!item || !canViewLoyalty || loyaltyRules.isLoading || loyaltyRuleLoaded.current) return;
    loyaltyRuleLoaded.current = true;
    hydrateLoyalty(
      loyaltyRule?.behavior ?? 'FIXED',
      loyaltyRule ? String(loyaltyRule.fixedPointsPerUnit) : '',
    );
  }, [canViewLoyalty, hydrateLoyalty, item, loyaltyRule, loyaltyRuleLoaded, loyaltyRules.isLoading]);

  useEffect(() => {
    if (fresh || initialPrice.current !== undefined || currentPrice.isLoading) return;
    const amount = currentPrice.data?.items[0]?.amount ?? null;
    initialPrice.current = amount;
    hydrateDefaultPrice(amount ? editableAmount(amount) : '');
  }, [currentPrice.data, currentPrice.isLoading, fresh, hydrateDefaultPrice, initialPrice]);

  useEffect(() => {
    if (fresh || variantsLoaded.current || variantPricesLoading || !existingVariants.data)
      return;
    variantsLoaded.current = true;
    hydrateVariants(
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
    hasVariants,
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
      title={fresh ? 'Tambah Item' : 'Edit Item'}
      description={
        fresh
          ? 'Isi informasi item, lalu tentukan cara penjualan dan harganya.'
          : 'Perbarui informasi, cara penjualan, dan harga.'
      }
      footer={<DialogFooter onClose={onClose} onSave={() => void save()} disabled={disabled} />}
    >
      {item ? (
        <CatalogItemEditorHeader
          item={item}
          api={api}
          hasVariants={hasVariants}
          canViewPricing={canViewPricing}
          variantPricesLoading={variantPricesLoading}
        />
      ) : null}

      <div className="divide-y divide-(--color-border)">
        <CatalogItemInformationSection
          editor={editor}
          fresh={fresh}
          categoryOptions={categoryOptions}
          canManageImage={canManageImage}
          existingImage={existingImage.data}
        />

        {type === 'SERVICE' ? (
          <CatalogItemServiceSection
            editor={editor}
            validDefaultDuration={validDefaultDuration}
          />
        ) : null}

        {!fresh && canViewLoyalty ? (
          <CatalogItemLoyaltySection
            editor={editor}
            loyaltyRule={loyaltyRule}
            configuration={loyaltyConfiguration.data}
            loading={loyaltyRules.isLoading || loyaltyConfiguration.isLoading}
            canConfigure={canConfigureLoyalty}
            loyaltyDraftValid={loyaltyDraftValid}
          />
        ) : null}

        {showPrice ? (
          <CatalogItemPricingSection
            editor={editor}
            model={model}
            currency={currency}
            fresh={fresh}
            hasVariants={hasVariants}
            canEditPrice={canEditPrice}
            currentPriceLoading={currentPrice.isLoading}
            itemPriceError={itemPriceError}
            storedItemPrice={storedItemPrice}
            formatMoney={formatMoney}
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
