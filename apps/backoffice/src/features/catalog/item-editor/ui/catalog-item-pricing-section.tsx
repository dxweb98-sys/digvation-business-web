import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { SellingModeChoice } from '../../ui/catalog-selling';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemPricingSection({
  editor,
  canEditPrice,
}: {
  editor: CatalogItemEditor;
  canEditPrice: boolean;
}) {
  const { variantSelectionMode } = editor.form;
  const { saving } = editor.ui;
  const { setFormField } = editor.actions;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--color-text-muted)]">
        Pilih cara item dijual
      </p>
      <SellingModeChoice
        value={variantSelectionMode}
        onChange={(value) => setFormField('variantSelectionMode', value)}
        disabled={!canEditPrice || saving}
      />
    </div>
  );
}
