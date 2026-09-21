import type { VariantSelectionMode } from '../api/catalog-api';

export type SellingModel = 'DIRECT' | 'VARIANT_REQUIRED' | 'ITEM_AND_VARIANTS';

export function sellingModel(
  hasActiveVariants: boolean,
  mode: VariantSelectionMode,
): SellingModel {
  if (!hasActiveVariants) return 'DIRECT';
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
    description: 'Item dijual dengan satu harga, tanpa memilih varian.',
  },
  VARIANT_REQUIRED: {
    label: 'Wajib pilih varian',
    description: 'Kasir harus memilih salah satu varian. Item tidak dijual tanpa varian.',
  },
  ITEM_AND_VARIANTS: {
    label: 'Bisa tanpa varian',
    description: 'Item juga dijual tanpa varian dengan harganya sendiri, selain setiap varian.',
  },
};
