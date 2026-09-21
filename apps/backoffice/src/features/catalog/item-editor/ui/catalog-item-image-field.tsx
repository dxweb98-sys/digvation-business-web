import { DButton } from '@digvation/ui';
import { Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
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

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const removeImage = () => {
    if (disabled) return;

    setError(null);
    onFileChange(null);
    onRemove();
  };

  return (
    <div className="w-28 shrink-0">
      <p className="mb-1.5 text-sm font-medium text-[var(--color-text)]">Foto Item</p>

      <div
        className={`group relative size-28 overflow-hidden rounded-xl border bg-[var(--color-surface)] shadow-sm transition-colors ${
          visibleUrl
            ? 'border-[var(--color-border)]'
            : 'border-dashed border-[var(--color-border)] hover:border-[var(--color-brand)]'
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          aria-label={visibleUrl ? 'Ganti foto item' : 'Tambah foto item'}
          className="absolute inset-0 z-10 grid size-full place-items-center disabled:cursor-not-allowed disabled:opacity-60"
        >
          {visibleUrl ? (
            <>
              <img
                src={visibleUrl}
                alt={itemName || copy('Catalog item image')}
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20 group-focus-within:bg-black/20" />
              <span className="relative grid size-9 place-items-center rounded-full bg-black/65 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Pencil className="size-4" aria-hidden="true" />
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1.5 px-2 text-center">
              <span className="grid size-8 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <Plus className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-medium leading-4 text-[var(--color-text)]">
                Klik untuk menambah
              </span>
              <ImageIcon
                className="size-3.5 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
            </span>
          )}
        </button>

        {visibleUrl ? (
          <div className="absolute right-1.5 top-1.5 z-20">
            <DButton
              type="button"
              variant="secondary"
              size="icon"
              aria-label={copy('Remove image')}
              disabled={disabled}
              onClick={removeImage}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </DButton>
          </div>
        ) : null}
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
