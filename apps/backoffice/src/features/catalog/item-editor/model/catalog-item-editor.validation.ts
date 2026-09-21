import { sellingModel, sellsItemItself } from '../../../../modules/catalog/catalog-selling';

import {
  isValidSellingPrice,
  variantDraftIssue,
} from './variant-price-draft';
import type {
  CatalogItemEditorForm,
  CatalogItemEditorLoyaltyDraft,
} from './catalog-item-editor.state';

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
  const model = sellingModel(hasVariants, form.variantSelectionMode);

  const itemPriceRequired = model === 'ITEM_AND_VARIANTS';
  const itemPriceMissing = itemPriceRequired && !isValidSellingPrice(form.defaultPrice);

  const validPrice =
    !sellsItemItself(model) || validOptionalMoney(form.defaultPrice);

  const variantsHaveIssues =
    form.variants.some((draft) => variantDraftIssue(draft, canEditPrice)) ||
    (canEditPrice && itemPriceMissing);

  const loyaltyPoints = Number(loyalty.pointsPerUnit);
  const loyaltyDraftValid = Number.isInteger(loyaltyPoints) && loyaltyPoints >= 0;

  return {
    parsedDefaultDuration,
    validDefaultDuration,
    hasVariants,
    model,
    itemPriceMissing,
    validPrice,
    variantsHaveIssues,
    loyaltyPoints,
    loyaltyDraftValid,
  };
}
