import { useToast } from '@digvation/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { normalizeBackofficeApiError } from '../../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../../auth/backoffice-auth-context';
import type {
  LoyaltyApi,
  LoyaltyEarningRule,
} from '../../../../modules/loyalty/loyalty-api';
import type { CatalogApi, Item } from '../../api/catalog-api';
import { sellsItemItself, type SellingModel } from '../../model/catalog-selling';
import {
  buildCatalogItemBaseInput,
  normalizeOptionalCatalogCode,
} from '../model/catalog-item-editor.mapper';
import {
  sameAmount,
  variantPriceSubmissions,
} from '../model/variant-price-draft';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function useCatalogItemEditorSave({
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
  existingImagePresent,
  disabled,
  variantsHaveIssues,
  onSaved,
  onClose,
}: {
  item: Item | null | undefined;
  editor: CatalogItemEditor;
  api: CatalogApi;
  loyaltyApi: LoyaltyApi;
  loyaltyRule: LoyaltyEarningRule | undefined;
  currency: string;
  model: SellingModel;
  parsedDefaultDuration: number | null;
  hasVariants: boolean;
  canCreateVariants: boolean;
  canCreatePricing: boolean;
  canEditPrice: boolean;
  canManageImage: boolean;
  shouldSaveLoyalty: boolean;
  loyaltyPoints: number;
  existingImagePresent: boolean;
  disabled: boolean;
  variantsHaveIssues: boolean;
  onSaved: () => void;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const { showToast } = useToast();

  const refreshPricingViews = useCallback(() => {
    for (const key of ['prices', 'variants', 'variant-price', 'edit-price', 'edit-variant-price']) {
      void client.invalidateQueries({ queryKey: ['catalog', key] });
    }
  }, [client]);

  return useCallback(async () => {
    if (disabled) return;

    if (variantsHaveIssues) {
      editor.actions.setShowIssues(true);
      return;
    }

    editor.actions.setSaving(true);

    let persistedItem: Item | null = null;
    let createdItem = false;

    try {
      const baseInput = buildCatalogItemBaseInput({
        form: editor.form,
        hasVariants,
        parsedDefaultDuration,
      });
      const effectiveFrom = new Date().toISOString();
      const createdVariantIds = new Map<string, string>();

      if (item === null) {
        const normalizedCode = normalizeOptionalCatalogCode(editor.form.code);
        persistedItem = await api.createItem({
          ...baseInput,
          ...(normalizedCode ? { code: normalizedCode } : {}),
          type: editor.form.type,
        });
        createdItem = true;

        if (canCreateVariants) {
          for (const draft of editor.form.variants) {
            const normalizedVariantCode = normalizeOptionalCatalogCode(draft.code);
            const created = await api.createVariant(persistedItem.id, {
              ...(normalizedVariantCode ? { code: normalizedVariantCode } : {}),
              name: draft.name.trim(),
              status: 'ACTIVE',
            });
            createdVariantIds.set(draft.key, created.id);
          }
        }

        if (
          canCreatePricing &&
          sellsItemItself(model) &&
          editor.form.defaultPrice.trim()
        ) {
          await api.createPrice({
            catalogItemId: persistedItem.id,
            catalogVariantId: null,
            locationId: null,
            currency,
            amount: editor.form.defaultPrice.trim(),
            effectiveFrom,
          });
        }
      } else if (item) {
        persistedItem = await api.updateItem(item, baseInput);

        const nextPrice = editor.form.defaultPrice.trim();
        const initialItemPrice = editor.refs.initialPrice.current ?? null;

        if (
          canEditPrice &&
          sellsItemItself(model) &&
          nextPrice &&
          !(initialItemPrice && sameAmount(nextPrice, initialItemPrice))
        ) {
          const input = {
            catalogItemId: item.id,
            catalogVariantId: null,
            locationId: null,
            currency,
            amount: nextPrice,
            effectiveFrom,
          };

          await (initialItemPrice ? api.changePrice(input) : api.createPrice(input));
        }
      }

      if (persistedItem && canEditPrice) {
        for (const submission of variantPriceSubmissions(editor.form.variants, createdVariantIds)) {
          await api.changeVariantPrices({
            catalogItemId: persistedItem.id,
            catalogVariantIds: submission.catalogVariantIds,
            currency,
            amount: submission.amount,
            effectiveFrom,
          });
        }
      }

      if (persistedItem && shouldSaveLoyalty) {
        try {
          await loyaltyApi.updateEarningRule(persistedItem.id, {
            expectedVersion: loyaltyRule?.version ?? 0,
            behavior: editor.loyalty.behavior,
            fixedPointsPerUnit: editor.loyalty.behavior === 'FIXED' ? loyaltyPoints : 0,
          });

          void client.invalidateQueries({ queryKey: ['loyalty', 'earning-rules'] });
        } catch (error) {
          if (!isSessionExpiredError(error)) {
            showToast({
              variant: 'danger',
              title: normalizeBackofficeApiError(
                error,
                'Item tersimpan, tetapi aturan poin belum diperbarui.',
              ).safeMessage,
            });
          }
        }
      }

      if (persistedItem && canManageImage) {
        if (editor.image.file) {
          await api.replaceItemImage(persistedItem.id, editor.image.file);
          void client.invalidateQueries({
            queryKey: ['catalog', 'image', persistedItem.id],
          });
        } else if (editor.image.removeRequested && existingImagePresent) {
          await api.removeItemImage(persistedItem.id);
          void client.invalidateQueries({
            queryKey: ['catalog', 'image', persistedItem.id],
          });
        }
      }

      refreshPricingViews();
      onSaved();

      showToast({
        variant: 'success',
        title: item === null ? 'Item berhasil ditambahkan.' : 'Item berhasil diperbarui.',
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
            : 'Item tersimpan, tetapi harga, gambar, atau pengaturan terkait belum selesai ' +
              'diperbarui.',
        });

        onClose();
      } else if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Item tidak dapat disimpan.').safeMessage,
        });
      }
    } finally {
      editor.actions.setSaving(false);
    }
  }, [
    api,
    canCreatePricing,
    canCreateVariants,
    canEditPrice,
    canManageImage,
    client,
    currency,
    disabled,
    editor,
    existingImagePresent,
    hasVariants,
    item,
    loyaltyApi,
    loyaltyPoints,
    loyaltyRule,
    model,
    onClose,
    onSaved,
    parsedDefaultDuration,
    refreshPricingViews,
    shouldSaveLoyalty,
    showToast,
    variantsHaveIssues,
  ]);
}
