import { DInput, DSelect, DTextarea } from '@digvation/ui';
import { Clock, Info } from 'lucide-react';

import type { CatalogItemImage, Category, Item } from '../../api/catalog-api';
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
  validDefaultDuration,
}: {
  editor: CatalogItemEditor;
  fresh: boolean;
  categoryOptions: Category[];
  canManageImage: boolean;
  existingImage: CatalogItemImage | null | undefined;
  validDefaultDuration: boolean;
}) {
  const {
    code,
    name,
    type,
    categoryId,
    description,
    lifecycle,
    defaultDurationMinutes,
  } = editor.form;
  const { file, removeRequested } = editor.image;
  const { saving } = editor.ui;
  const { setFormField, selectImage, requestImageRemoval } = editor.actions;

  return (
    <CatalogSection
      title="Informasi Item"
      actions={
        <span className="text-xs font-normal normal-case text-[var(--color-text-muted)]">
          Tampil di kasir POS
        </span>
      }
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex gap-4">
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

          <div className="grid min-w-0 flex-1 content-start gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DInput
                label="Nama Item"
                value={name}
                onChange={(value) => setFormField('name', value)}
                placeholder="Contoh: Hair Color Treatment"
              />
            </div>

            <DInput
              label="Kode Item"
              value={code}
              onChange={(value) => setFormField('code', value)}
              disabled={!fresh}
              hint={fresh ? 'Kosongkan untuk kode otomatis.' : 'Terkunci'}
            />

            <DSelect
              label="Tipe"
              value={type}
              onChange={(value) => setFormField('type', value as Item['type'])}
              disabled={!fresh}
              options={[
                { label: 'Produk', value: 'PRODUCT' },
                { label: 'Layanan / Jasa', value: 'SERVICE' },
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
                { label: 'Aktif Dijual', value: 'ACTIVE' },
                { label: 'Nonaktif', value: 'INACTIVE' },
              ]}
            />

            {type === 'SERVICE' ? (
              <div className="lg:col-span-1">
                <DInput
                  label="Durasi Layanan (menit)"
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
                  hint="Opsional."
                />
              </div>
            ) : null}

            <div className={type === 'SERVICE' ? 'lg:col-span-2' : 'lg:col-span-3'}>
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

        {type === 'SERVICE' ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>
              Durasi membantu operasional memahami estimasi layanan. Nilai tetap mengikuti
              kontrak Catalog yang ada dan boleh dikosongkan.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <p>
              Informasi ini digunakan oleh Catalog dan ditampilkan sesuai kebutuhan aplikasi
              operasional.
            </p>
          </div>
        )}
      </div>
    </CatalogSection>
  );
}
