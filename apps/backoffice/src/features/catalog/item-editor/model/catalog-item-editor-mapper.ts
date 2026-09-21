import type { CatalogItemEditorForm } from './catalog-item-editor-state';

export function buildCatalogItemBaseInput({
  form,
  hasVariants,
  parsedDefaultDuration,
}: {
  form: CatalogItemEditorForm;
  hasVariants: boolean;
  parsedDefaultDuration: number | null;
}) {
  const serviceDefinition =
    form.type === 'SERVICE'
      ? { defaultDurationMinutes: parsedDefaultDuration }
      : undefined;

  return {
    ...(hasVariants ? { variantSelectionMode: form.variantSelectionMode } : {}),
    name: form.name.trim(),
    categoryId: form.categoryId,
    description: form.description.trim() || null,
    lifecycle: form.lifecycle,
    fulfillmentBehavior:
      form.type === 'SERVICE' ? ('TRACKED' as const) : ('INSTANT' as const),
    ...(serviceDefinition ? { serviceDefinition } : {}),
  };
}

export function normalizeOptionalCatalogCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}
