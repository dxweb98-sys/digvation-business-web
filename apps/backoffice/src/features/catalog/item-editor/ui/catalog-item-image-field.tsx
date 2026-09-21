import { DButton } from '@digvation/ui';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  CATALOG_IMAGE_CONTENT_TYPES,
  CATALOG_IMAGE_MAX_BYTES,
  type CatalogItemImage,
} from '../../api/catalog-api';
import { useCatalogLocalization } from '../../localization/use-catalog-localization';

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
    <div className="w-28 shrink-0">
      <p className="mb-1.5 text-sm font-medium text-[var(--color-text)]">Foto Item</p>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <button
          type="button"
          className="grid size-24 w-full place-items-center overflow-hidden bg-[var(--color-surface-muted)] text-left"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-label={visibleUrl ? 'Ganti foto item' : 'Pilih foto item'}
        >
          {visibleUrl ? (
            <img
              src={visibleUrl}
              alt={itemName || copy('Catalog item image')}
              className="size-full object-cover"
            />
          ) : (
            <div className="text-center">
              <ImageIcon
                className="mx-auto size-7 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
              <span className="mt-1.5 block text-xs text-[var(--color-text-muted)]">
                Pilih foto
              </span>
            </div>
          )}
        </button>

        <div className="flex items-center justify-between gap-1 border-t border-[var(--color-border)] px-2 py-1.5">
          <DButton
            type="button"
            variant="link"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {visibleUrl ? 'Ganti' : 'Pilih'}
          </DButton>

          {visibleUrl ? (
            <DButton
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy('Remove image')}
              disabled={disabled}
              onClick={() => {
                setError(null);
                onFileChange(null);
                onRemove();
              }}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </DButton>
          ) : null}
        </div>
      </div>

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

      {error ? (
        <p className="mt-1 text-[10px] leading-4 text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}
