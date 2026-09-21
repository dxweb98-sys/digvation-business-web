import { DInput, DSelect, DTextarea } from '@digvation/ui';
import { Info } from 'lucide-react';

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
      icon={<Info className="size-4" aria-hidden="true" />}
      actions={
        <span className="text-xs font-normal normal-case text-[var(--color-text-muted)]">
          Tampil di kasir POS
        </span>
      }
    >
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div
          className={
            canManageImage
              ? 'grid gap-5 lg:grid-cols-[5rem_minmax(0,1fr)]'
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

          <div className="min-w-0 space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Identitas & Klasifikasi
              </p>

              <div className="grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <DInput
                    label="Nama Item"
                    value={name}
                    onChange={(value) => setFormField('name', value)}
                    placeholder="Contoh: Hair Color Treatment"
                  />
                </div>

                <div className="lg:col-span-4">
                  <DInput
                    label="Kode Item"
                    value={code}
                    onChange={(value) => setFormField('code', value)}
                    disabled={!fresh}
                    hint={fresh ? 'Kosongkan untuk kode otomatis.' : 'Terkunci'}
                  />
                </div>

                <div className="lg:col-span-4">
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
                </div>

                <div className="lg:col-span-4">
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
                </div>

                <div className="lg:col-span-4">
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

            <div className="border-t border-[var(--color-border)] pt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Detail Item
              </p>

              <div className="grid gap-3 lg:grid-cols-12">
                {type === 'SERVICE' ? (
                  <div className="lg:col-span-4">
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

                <div className={type === 'SERVICE' ? 'lg:col-span-8' : 'lg:col-span-12'}>
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
          </div>
        </div>
      </div>
    </CatalogSection>
  );
}
