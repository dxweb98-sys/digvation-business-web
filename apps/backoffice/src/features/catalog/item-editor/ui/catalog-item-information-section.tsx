import { DInput, DSelect } from '@digvation/ui';

import type { CatalogItemImage, Item } from '../../api/catalog-api';
import { CatalogPanel } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { CatalogItemImageField } from './catalog-item-image-field';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemInformationSection({
  editor,
  fresh,
  canManageImage,
  existingImage,
}: {
  editor: CatalogItemEditor;
  fresh: boolean;
  canManageImage: boolean;
  existingImage: CatalogItemImage | null | undefined;
}) {
  const { code, name, lifecycle } = editor.form;
  const { file, removeRequested } = editor.image;
  const { saving } = editor.ui;
  const { setFormField, selectImage, requestImageRemoval } = editor.actions;

  return (
    <CatalogPanel className="p-5" ariaLabel="Informasi Item">
      <div
        className={
          canManageImage
            ? 'grid gap-5 md:grid-cols-[7rem_minmax(0,1fr)] md:items-start'
            : 'grid gap-5'
        }
      >
        {canManageImage ? (
          <CatalogItemImageField
            itemName={name}
            existingImage={existingImage}
            selectedFile={file}
            removeRequested={removeRequested}
            disabled={saving}
            onFileChange={selectImage}
            onRemove={requestImageRemoval}
          />
        ) : null}

        <div className="min-w-0">
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <DInput
                label="Nama Item"
                value={name}
                onChange={(value) => setFormField('name', value)}
                placeholder="Contoh: Hair Color Treatment"
              />
            </div>

            <div className="lg:col-span-3">
              <DInput
                label="Kode Item"
                value={code}
                onChange={(value) => setFormField('code', value)}
                disabled={!fresh}
                hint={fresh ? 'Kosongkan untuk kode otomatis.' : 'Terkunci'}
              />
            </div>

            <div className="lg:col-span-2">
              <DSelect
                label="Status"
                value={lifecycle}
                onChange={(value) => setFormField('lifecycle', value as Item['lifecycle'])}
                options={[
                  { label: 'Draft', value: 'DRAFT' },
                  { label: 'Aktif Dijual', value: 'ACTIVE' },
                  { label: 'Nonaktif', value: 'INACTIVE' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </CatalogPanel>
  );
}
