import { DInput } from '@digvation/ui';

import { CatalogSection } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemServiceSection({
  editor,
  validDefaultDuration,
}: {
  editor: CatalogItemEditor;
  validDefaultDuration: boolean;
}) {
  const { defaultDurationMinutes } = editor.form;
  const { setFormField } = editor.actions;

  return (
    <CatalogSection title="Pengaturan layanan" tone="secondary">
      <div className="max-w-xs">
        <DInput
          label="Durasi Layanan (menit)"
          hint="Opsional."
          value={defaultDurationMinutes}
          onChange={(value) => setFormField('defaultDurationMinutes', value)}
          type="number"
          min={1}
          placeholder="30"
          error={
            validDefaultDuration
              ? undefined
              : 'Durasi harus berupa angka bulat positif.'
          }
        />
      </div>
    </CatalogSection>
  );
}
