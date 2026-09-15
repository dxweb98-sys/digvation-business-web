import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const catalogCopy: Record<string, { id: string; en: string }> = {
  'Master Data': { id: 'Data utama', en: 'Master data' },
  Items: { id: 'Item', en: 'Items' },
  Categories: { id: 'Kategori', en: 'Categories' },
  'Manage items, categories, pricing, variants, and tax assignment from one catalog workspace.': {
    id: 'Kelola item, kategori, harga, varian, dan pajak.',
    en: 'Manage items, categories, pricing, variants, and tax.',
  },
  'Complete the essentials first. Pricing and variants can be prepared in the same flow.': {
    id: 'Lengkapi informasi utama, lalu atur harga dan varian bila diperlukan.',
    en: 'Complete the main information, then add pricing and variants if needed.',
  },
  'Update item identity, tax assignment, and service behavior.': {
    id: 'Perbarui informasi item, pajak, dan pengaturan layanan.',
    en: 'Update item information, tax, and service settings.',
  },
  'Identity and selling behavior for this catalog item.': {
    id: 'Informasi utama item katalog.',
    en: 'Main catalog item information.',
  },
  'Pricing & tax': { id: 'Harga dan pajak', en: 'Pricing and tax' },
  'Set the starting price and item-specific tax behavior without leaving item creation.': {
    id: 'Atur harga awal dan pajak item.',
    en: 'Set the starting price and item tax.',
  },
  'Item tax category': { id: 'Kategori pajak item', en: 'Item tax category' },
  'Leave empty when this item has no item-specific tax. Transaction tax may still apply.': {
    id: 'Kosongkan jika item tidak memiliki pajak khusus. Pajak transaksi tetap dapat berlaku.',
    en: 'Leave empty if this item has no specific tax. Transaction tax may still apply.',
  },
  'Item tax is currently disabled in Tax settings. The category can still be prepared here.': {
    id: 'Pajak item sedang dinonaktifkan. Kategori tetap dapat dipilih.',
    en: 'Item tax is currently disabled. You can still select a category.',
  },
  'Optional. Variant prices inherit this price unless an override is provided.': {
    id: 'Opsional. Varian menggunakan harga ini jika tidak memiliki harga sendiri.',
    en: 'Optional. Variants use this price unless they have their own price.',
  },
  'Price must be greater than zero with up to four decimal places.': {
    id: 'Harga harus lebih dari nol dengan maksimal empat angka desimal.',
    en: 'Price must be greater than zero with up to four decimal places.',
  },
  'Define how this service is staffed and fulfilled.': {
    id: 'Atur cara layanan dikerjakan.',
    en: 'Configure how this service is performed.',
  },
  'Initial variants': { id: 'Varian awal', en: 'Initial variants' },
  'Optional. Add the variants you already know now; more can be added from item details later.': {
    id: 'Opsional. Tambahkan varian sekarang atau nanti dari detail item.',
    en: 'Optional. Add variants now or later from item details.',
  },
  'Variant name': { id: 'Nama varian', en: 'Variant name' },
  'For example, Large': { id: 'Contoh: Besar', en: 'For example: Large' },
  'Remove variant': { id: 'Hapus varian', en: 'Remove variant' },
  'No initial variants. The item will use its default price directly.': {
    id: 'Belum ada varian. Item menggunakan harga default.',
    en: 'No variants yet. The item uses its default price.',
  },
  'Each configured variant needs a name and any entered price must be valid.': {
    id: 'Setiap varian harus memiliki nama dan harga yang valid bila diisi.',
    en: 'Each variant needs a name and a valid price when entered.',
  },
  'Item created, but its initial setup is incomplete.': {
    id: 'Item dibuat, tetapi pengaturan awal belum lengkap.',
    en: 'Item created, but the initial setup is incomplete.',
  },
  'Item was saved, but its image or related setup could not be completed.': {
    id: 'Item disimpan, tetapi gambar atau pengaturan terkait belum selesai.',
    en: 'Item was saved, but its image or related setup could not be completed.',
  },
  'Item image': { id: 'Gambar item', en: 'Item image' },
  'Catalog item image': { id: 'Gambar item katalog', en: 'Catalog item image' },
  'JPEG, PNG, or WebP. Maximum 1 MB. One primary image is kept per item.': {
    id: 'JPEG, PNG, atau WebP. Maksimum 1 MB.',
    en: 'JPEG, PNG, or WebP. Maximum 1 MB.',
  },
  'Choose image': { id: 'Pilih gambar', en: 'Choose image' },
  'Replace image': { id: 'Ganti gambar', en: 'Replace image' },
  'Remove image': { id: 'Hapus gambar', en: 'Remove image' },
  'Use a JPEG, PNG, or WebP image.': {
    id: 'Gunakan gambar JPEG, PNG, atau WebP.',
    en: 'Use a JPEG, PNG, or WebP image.',
  },
  'Image must be 1 MB or smaller.': {
    id: 'Ukuran gambar maksimal 1 MB.',
    en: 'Image must be 1 MB or smaller.',
  },
  'Item overview': { id: 'Ringkasan item', en: 'Item overview' },
  'No item-specific tax': { id: 'Tanpa pajak khusus item', en: 'No item-specific tax' },
  'This item uses its assigned item tax category. Transaction tax may also apply when enabled.': {
    id: 'Item menggunakan kategori pajak yang dipilih. Pajak transaksi juga dapat berlaku.',
    en: 'The item uses its selected tax category. Transaction tax may also apply.',
  },
  'No item-specific tax is assigned. Transaction tax may still apply when enabled.': {
    id: 'Tidak ada pajak khusus item. Pajak transaksi tetap dapat berlaku.',
    en: 'No item-specific tax is assigned. Transaction tax may still apply.',
  },
  'Operational defaults used when this service is sold and fulfilled.': {
    id: 'Pengaturan default saat layanan dijual dan dikerjakan.',
    en: 'Default settings used when the service is sold and performed.',
  },
  minutes: { id: 'menit', en: 'minutes' },
  'Open only when you need to review or maintain variant-specific configuration.': {
    id: 'Buka untuk melihat atau mengubah pengaturan varian.',
    en: 'Open to review or change variant settings.',
  },
  'Deactivate variant': { id: 'Nonaktifkan varian', en: 'Deactivate variant' },
  'Reactivate variant': { id: 'Aktifkan kembali varian', en: 'Reactivate variant' },
  'Deactivate variant?': { id: 'Nonaktifkan varian?', en: 'Deactivate variant?' },
  'Reactivate variant?': { id: 'Aktifkan kembali varian?', en: 'Reactivate variant?' },
  'This variant will stop appearing in active selling choices. Existing transaction and price history will be preserved.':
    {
      id: 'Varian tidak lagi tersedia untuk transaksi baru. Riwayat tetap tersimpan.',
      en: 'The variant will no longer be available for new transactions. History is preserved.',
    },
  'This variant will become available for active selling choices again.': {
    id: 'Varian akan tersedia kembali untuk transaksi baru.',
    en: 'The variant will be available for new transactions again.',
  },
  'Historical default prices stay immutable so past sales remain auditable.': {
    id: 'Harga sebelumnya tetap tersimpan dalam riwayat.',
    en: 'Previous prices remain in history.',
  },
  'Current default price': { id: 'Harga default saat ini', en: 'Current default price' },
  'Rows per page': { id: 'Baris per halaman', en: 'Rows per page' },
  Page: { id: 'Halaman', en: 'Page' },
  Previous: { id: 'Sebelumnya', en: 'Previous' },
  Next: { id: 'Berikutnya', en: 'Next' },
  'Category added.': { id: 'Kategori ditambahkan.', en: 'Category added.' },
  'Category updated.': { id: 'Kategori diperbarui.', en: 'Category updated.' },
  'Variant added.': { id: 'Varian ditambahkan.', en: 'Variant added.' },
  'Variant updated.': { id: 'Varian diperbarui.', en: 'Variant updated.' },
  'Could not save category.': {
    id: 'Kategori tidak dapat disimpan.',
    en: 'Could not save category.',
  },
  'Could not save variant.': { id: 'Varian tidak dapat disimpan.', en: 'Could not save variant.' },
  'Tax to set aside': { id: 'Pajak yang perlu disisihkan', en: 'Tax to set aside' },
  'Tax by item': { id: 'Pajak per item', en: 'Tax by item' },
  Variant: { id: 'Varian', en: 'Variant' },
  Quantity: { id: 'Jumlah', en: 'Quantity' },
};

export function useCatalogLocalization() {
  const base = useBackofficeLocalization();
  return {
    ...base,
    copy: (value: string) => catalogCopy[value]?.[base.locale] ?? base.copy(value),
  };
}
