import type { CatalogItemEditorForm } from './catalog-item-editor-state';

export function buildCatalogItemBaseInput({
  form,
  parsedDefaultDuration,
}: {
  form: CatalogItemEditorForm;
  parsedDefaultDuration: number | null;
}) {
  const serviceDefinition =
    form.type === 'SERVICE' ? { defaultDurationMinutes: parsedDefaultDuration } : undefined;

  return {
    ...(form.type === 'PRODUCT'
      ? {
          productUsage: form.directlySellable
            ? ('STANDALONE_AND_COMPONENT' as const)
            : ('COMPONENT_ONLY' as const),
        }
      : {}),
    variantSelectionMode: form.variantSelectionMode,
    requireAdditionalItemAtSale: form.requireAdditionalItemAtSale,
    name: form.name.trim(),
    categoryId: form.categoryId,
    description: form.description.trim() || null,
    lifecycle: form.lifecycle,
    fulfillmentBehavior: form.type === 'SERVICE' ? ('TRACKED' as const) : ('INSTANT' as const),
    ...(serviceDefinition ? { serviceDefinition } : {}),
  };
}

export function normalizeOptionalCatalogCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}
