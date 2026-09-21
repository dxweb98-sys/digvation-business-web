import { DInput, DSelect, DTextarea } from '@digvation/ui';

import type {
  CatalogItemImage,
  Category,
  Item,
} from '../../api/catalog-api';
import { CatalogSection } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';
import { CatalogItemImageField } from './catalog-item-image-field';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemInformationSection({
  editor,
  fresh,
  categoryOptions,
  canManageImage,
  existingImage,
}: {
  editor: CatalogItemEditor;
  fresh: boolean;
  categoryOptions: Category[];
  canManageImage: boolean;
  existingImage: CatalogItemImage | null | undefined;
}) {
  const {
    code,
    name,
    type,
    categoryId,
    description,
    lifecycle,
  } = editor.form;
  const { file, removeRequested } = editor.image;
  const { saving } = editor.ui;
  const { setFormField, selectImage, requestImageRemoval } = editor.actions;

  return (
    <CatalogSection
      title="Informasi item"
      description="Nama dan klasifikasi yang tampil di katalog dan kasir."
    >
      <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
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

        <div className="grid min-w-0 content-start gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <DInput
              label="Nama Item"
              value={name}
              onChange={(value) => setFormField('name', value)}
              placeholder="Contoh: Coffee Latte"
            />
          </div>

          <DInput
            label="Kode Item"
            value={code}
            onChange={(value) => setFormField('code', value)}
            disabled={!fresh}
            hint={
              fresh
                ? 'Kosongkan untuk membuat kode otomatis.'
                : 'Kode tidak dapat diubah setelah dibuat.'
            }
          />

          <DSelect
            label="Tipe"
            value={type}
            onChange={(value) => setFormField('type', value as Item['type'])}
            disabled={!fresh}
            options={[
              { label: 'Produk', value: 'PRODUCT' },
              { label: 'Jasa', value: 'SERVICE' },
            ]}
          />

          <DSelect
            label="Kategori"
            value={categoryId}
            onChange={(value) => setFormField('categoryId', value as string | null)}
            clearable
            options={categoryOptions.map((category) => ({
              label:
                category.status === 'ACTIVE'
                  ? category.name
                  : `${category.name} · Nonaktif`,
              value: category.id,
            }))}
          />

          <DSelect
            label="Status"
            value={lifecycle}
            onChange={(value) => setFormField('lifecycle', value as Item['lifecycle'])}
            options={[
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Aktif', value: 'ACTIVE' },
              { label: 'Nonaktif', value: 'INACTIVE' },
            ]}
          />

          <div className="sm:col-span-2">
            <DTextarea
              label="Deskripsi"
              value={description}
              onChange={(value) => setFormField('description', value)}
              placeholder="Deskripsi item (opsional)"
              className="min-h-20"
            />
          </div>
        </div>
      </div>
    </CatalogSection>
  );
}
