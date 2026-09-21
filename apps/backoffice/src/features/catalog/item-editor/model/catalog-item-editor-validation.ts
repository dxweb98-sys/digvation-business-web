import {
  editorSellingModel,
  sellsItemItself,
} from '../../model/catalog-selling';

import {
  isValidSellingPrice,
  variantDraftIssue,
} from './variant-price-draft';
import type {
  CatalogItemEditorForm,
  CatalogItemEditorLoyaltyDraft,
} from './catalog-item-editor-state';

function validOptionalMoney(value: string) {
  return !value.trim() || isValidSellingPrice(value);
}

export function deriveCatalogItemEditorValidation({
  form,
  loyalty,
  canEditPrice,
}: {
  form: CatalogItemEditorForm;
  loyalty: CatalogItemEditorLoyaltyDraft;
  canEditPrice: boolean;
}) {
  const parsedDefaultDuration = form.defaultDurationMinutes.trim()
    ? Number(form.defaultDurationMinutes)
    : null;

  const validDefaultDuration =
    parsedDefaultDuration === null ||
    (Number.isInteger(parsedDefaultDuration) && parsedDefaultDuration > 0);

  const hasVariants = form.variants.length > 0;
  const model = editorSellingModel(form.variantSelectionMode);
  const requiredVariantMissing =
    form.variantSelectionMode === 'REQUIRED' && !hasVariants;

  // Preserve the accepted price rule: the parent price becomes mandatory when it is
  // sold alongside actual variants. A no-variant draft may still be saved without price.
  const itemPriceRequired =
    form.variantSelectionMode === 'OPTIONAL' && hasVariants;
  const itemPriceMissing =
    itemPriceRequired && !isValidSellingPrice(form.defaultPrice);

  const validPrice =
    !sellsItemItself(model) || validOptionalMoney(form.defaultPrice);

  const variantsHaveIssues =
    requiredVariantMissing ||
    form.variants.some((draft) => variantDraftIssue(draft, canEditPrice)) ||
    (canEditPrice && itemPriceMissing);

  const loyaltyPoints = Number(loyalty.pointsPerUnit);
  const loyaltyDraftValid = Number.isInteger(loyaltyPoints) && loyaltyPoints >= 0;

  return {
    parsedDefaultDuration,
    validDefaultDuration,
    hasVariants,
    model,
    requiredVariantMissing,
    itemPriceMissing,
    validPrice,
    variantsHaveIssues,
    loyaltyPoints,
    loyaltyDraftValid,
  };
}
