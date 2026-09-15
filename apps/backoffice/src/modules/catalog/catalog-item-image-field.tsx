import { DButton } from '@digvation/ui';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATALOG_IMAGE_CONTENT_TYPES,
  CATALOG_IMAGE_MAX_BYTES,
  type CatalogItemImage,
} from './catalog-api';
import { useCatalogLocalization } from './catalog-localization';

export function CatalogItemImageField({
  itemName,
  existingImage,
  selectedFile,
  removeRequested,
  disabled = false,
  onFileChange,
  onRemove,
}: {
  itemName: string;
  existingImage?: CatalogItemImage | null | undefined;
  selectedFile: File | null;
  removeRequested: boolean;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onRemove: () => void;
}) {
  const { copy } = useCatalogLocalization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const visibleUrl = previewUrl ?? (!removeRequested ? existingImage?.url : null) ?? null;

  const choose = (file: File | undefined) => {
    if (!file) return;
    if (!(CATALOG_IMAGE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setError(copy('Use a JPEG, PNG, or WebP image.'));
      return;
    }
    if (file.size <= 0 || file.size > CATALOG_IMAGE_MAX_BYTES) {
      setError(copy('Image must be 1 MB or smaller.'));
      return;
    }
    setError(null);
    onFileChange(file);
  };

  return (
    <section className="rounded-(--radius-card) border border-(--color-border) p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface-muted)">
          {visibleUrl ? (
            <img
              src={visibleUrl}
              alt={itemName || copy('Catalog item image')}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-8 text-(--color-text-muted)" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{copy('Item image')}</h2>
          <p className="mt-1 text-xs leading-5 text-(--color-text-muted)">
            {copy('JPEG, PNG, or WebP. Maximum 1 MB. One primary image is kept per item.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <DButton
              type="button"
              variant="secondary"
              leftIcon={<Upload className="size-4" />}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {visibleUrl ? copy('Replace image') : copy('Choose image')}
            </DButton>
            {visibleUrl ? (
              <DButton
                type="button"
                variant="secondary"
                leftIcon={<Trash2 className="size-4" />}
                disabled={disabled}
                onClick={() => {
                  setError(null);
                  onFileChange(null);
                  onRemove();
                }}
              >
                {copy('Remove image')}
              </DButton>
            ) : null}
          </div>
          {selectedFile ? (
            <p className="mt-2 text-xs text-(--color-text-muted)">
              {selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-(--color-danger)">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
