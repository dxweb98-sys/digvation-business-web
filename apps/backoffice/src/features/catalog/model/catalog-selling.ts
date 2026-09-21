import type { VariantSelectionMode } from '../api/catalog-api';

export type SellingModel = 'DIRECT' | 'VARIANT_REQUIRED' | 'ITEM_AND_VARIANTS';

export function sellingModel(
  hasActiveVariants: boolean,
  mode: VariantSelectionMode,
): SellingModel {
  if (!hasActiveVariants) return 'DIRECT';
  return mode === 'OPTIONAL' ? 'ITEM_AND_VARIANTS' : 'VARIANT_REQUIRED';
}

/**
 * Editor intent must remain stable before variants exist.
 * Runtime/detail can still collapse an item with zero active variants to DIRECT.
 */
export function editorSellingModel(mode: VariantSelectionMode): SellingModel {
  return mode === 'OPTIONAL' ? 'ITEM_AND_VARIANTS' : 'VARIANT_REQUIRED';
}

export function sellsItemItself(model: SellingModel) {
  return model !== 'VARIANT_REQUIRED';
}

export const sellingModelCopy: Record<
  SellingModel,
  { label: string; description: string }
> = {
  DIRECT: {
    label: 'Dijual langsung',
    description: 'Item utama dijual langsung sebagai opsi default.',
  },
  VARIANT_REQUIRED: {
    label: 'Wajib pilih varian',
    description: 'Kasir wajib memilih varian. Opsi default / item utama tidak dijual.',
  },
  ITEM_AND_VARIANTS: {
    label: 'Bisa tanpa varian',
    description: 'Item utama tetap dijual sebagai opsi default; varian menjadi pilihan tambahan.',
  },
};
