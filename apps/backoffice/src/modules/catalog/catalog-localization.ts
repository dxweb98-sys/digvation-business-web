import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const catalogCopy: Record<string, { id: string; en: string }> = {
  'Master Data': { id: 'Data Master', en: 'Master Data' },
  Items: { id: 'Item', en: 'Items' },
  Categories: { id: 'Kategori', en: 'Categories' },
  'Manage items, categories, pricing, variants, and tax assignment from one catalog workspace.': {
    id: 'Kelola item, kategori, harga, varian, dan penetapan pajak dari satu ruang kerja katalog.',
    en: 'Manage items, categories, pricing, variants, and tax assignment from one catalog workspace.',
  },
  'Complete the essentials first. Pricing and variants can be prepared in the same flow.': {
    id: 'Lengkapi informasi utama terlebih dahulu. Harga dan varian dapat disiapkan dalam alur yang sama.',
    en: 'Complete the essentials first. Pricing and variants can be prepared in the same flow.',
  },
  'Update item identity, tax assignment, and service behavior.': {
    id: 'Perbarui identitas item, penetapan pajak, dan perilaku layanan.',
    en: 'Update item identity, tax assignment, and service behavior.',
  },
  'Identity and selling behavior for this catalog item.': {
    id: 'Identitas dan perilaku penjualan untuk item katalog ini.',
    en: 'Identity and selling behavior for this catalog item.',
  },
  'Pricing & tax': { id: 'Harga & pajak', en: 'Pricing & tax' },
  'Set the starting price and item-specific tax behavior without leaving item creation.': {
    id: 'Tetapkan harga awal dan pajak khusus item tanpa keluar dari proses pembuatan item.',
    en: 'Set the starting price and item-specific tax behavior without leaving item creation.',
  },
  'Item tax category': { id: 'Kategori pajak item', en: 'Item tax category' },
  'Leave empty when this item has no item-specific tax. Transaction tax may still apply.': {
    id: 'Kosongkan jika item ini tidak memiliki pajak khusus item. Pajak transaksi tetap dapat berlaku.',
    en: 'Leave empty when this item has no item-specific tax. Transaction tax may still apply.',
  },
  'Item tax is currently disabled in Tax settings. The category can still be prepared here.': {
    id: 'Pajak item sedang dinonaktifkan pada pengaturan Pajak. Kategorinya tetap dapat disiapkan di sini.',
    en: 'Item tax is currently disabled in Tax settings. The category can still be prepared here.',
  },
  'Optional. Variant prices inherit this price unless an override is provided.': {
    id: 'Opsional. Harga varian mewarisi harga ini kecuali diberikan harga khusus.',
    en: 'Optional. Variant prices inherit this price unless an override is provided.',
  },
  'Price must be greater than zero with up to four decimal places.': {
    id: 'Harga harus lebih besar dari nol dengan maksimal empat angka desimal.',
    en: 'Price must be greater than zero with up to four decimal places.',
  },
  'Define how this service is staffed and fulfilled.': {
    id: 'Tentukan bagaimana layanan ini ditugaskan dan dipenuhi.',
    en: 'Define how this service is staffed and fulfilled.',
  },
  'Initial variants': { id: 'Varian awal', en: 'Initial variants' },
  'Optional. Add the variants you already know now; more can be added from item details later.': {
    id: 'Opsional. Tambahkan varian yang sudah diketahui sekarang; varian lain dapat ditambahkan dari detail item nanti.',
    en: 'Optional. Add the variants you already know now; more can be added from item details later.',
  },
  'Variant name': { id: 'Nama varian', en: 'Variant name' },
  'For example, Large': { id: 'Contoh, Besar', en: 'For example, Large' },
  'Remove variant': { id: 'Hapus varian', en: 'Remove variant' },
  'No initial variants. The item will use its default price directly.': {
    id: 'Belum ada varian awal. Item akan menggunakan harga default secara langsung.',
    en: 'No initial variants. The item will use its default price directly.',
  },
  'Each configured variant needs a name and any entered price must be valid.': {
    id: 'Setiap varian yang dikonfigurasi harus memiliki nama dan harga yang diisi harus valid.',
    en: 'Each configured variant needs a name and any entered price must be valid.',
  },
  'Item created, but its initial setup is incomplete.': {
    id: 'Item berhasil dibuat, tetapi konfigurasi awalnya belum lengkap.',
    en: 'Item created, but its initial setup is incomplete.',
  },
  'Item was saved, but its image or related setup could not be completed.': {
    id: 'Item sudah tersimpan, tetapi gambar atau konfigurasi terkait belum berhasil diselesaikan.',
    en: 'Item was saved, but its image or related setup could not be completed.',
  },
  'Item image': { id: 'Gambar item', en: 'Item image' },
  'Catalog item image': { id: 'Gambar item katalog', en: 'Catalog item image' },
  'JPEG, PNG, or WebP. Maximum 1 MB. One primary image is kept per item.': {
    id: 'JPEG, PNG, atau WebP. Maksimum 1 MB. Satu gambar utama disimpan untuk setiap item.',
    en: 'JPEG, PNG, or WebP. Maximum 1 MB. One primary image is kept per item.',
  },
  'Choose image': { id: 'Pilih gambar', en: 'Choose image' },
  'Replace image': { id: 'Ganti gambar', en: 'Replace image' },
  'Remove image': { id: 'Hapus gambar', en: 'Remove image' },
  'Use a JPEG, PNG, or WebP image.': {
    id: 'Gunakan gambar JPEG, PNG, atau WebP.',
    en: 'Use a JPEG, PNG, or WebP image.',
  },
  'Image must be 1 MB or smaller.': {
    id: 'Ukuran gambar harus 1 MB atau lebih kecil.',
    en: 'Image must be 1 MB or smaller.',
  },
  'Item overview': { id: 'Ringkasan item', en: 'Item overview' },
  'No item-specific tax': { id: 'Tanpa pajak khusus item', en: 'No item-specific tax' },
  'This item uses its assigned item tax category. Transaction tax may also apply when enabled.': {
    id: 'Item ini menggunakan kategori pajak item yang ditetapkan. Pajak transaksi juga dapat berlaku jika diaktifkan.',
    en: 'This item uses its assigned item tax category. Transaction tax may also apply when enabled.',
  },
  'No item-specific tax is assigned. Transaction tax may still apply when enabled.': {
    id: 'Tidak ada pajak khusus item yang ditetapkan. Pajak transaksi tetap dapat berlaku jika diaktifkan.',
    en: 'No item-specific tax is assigned. Transaction tax may still apply when enabled.',
  },
  'Operational defaults used when this service is sold and fulfilled.': {
    id: 'Nilai default operasional yang digunakan saat layanan dijual dan dipenuhi.',
    en: 'Operational defaults used when this service is sold and fulfilled.',
  },
  minutes: { id: 'menit', en: 'minutes' },
  'Open only when you need to review or maintain variant-specific configuration.': {
    id: 'Buka hanya saat Anda perlu meninjau atau mengelola konfigurasi khusus varian.',
    en: 'Open only when you need to review or maintain variant-specific configuration.',
  },
  'Deactivate variant': { id: 'Nonaktifkan varian', en: 'Deactivate variant' },
  'Reactivate variant': { id: 'Aktifkan kembali varian', en: 'Reactivate variant' },
  'Deactivate variant?': { id: 'Nonaktifkan varian?', en: 'Deactivate variant?' },
  'Reactivate variant?': { id: 'Aktifkan kembali varian?', en: 'Reactivate variant?' },
  'This variant will stop appearing in active selling choices. Existing transaction and price history will be preserved.': {
    id: 'Varian ini tidak akan lagi muncul pada pilihan penjualan aktif. Riwayat transaksi dan harga yang sudah ada tetap dipertahankan.',
    en: 'This variant will stop appearing in active selling choices. Existing transaction and price history will be preserved.',
  },
  'This variant will become available for active selling choices again.': {
    id: 'Varian ini akan kembali tersedia pada pilihan penjualan aktif.',
    en: 'This variant will become available for active selling choices again.',
  },
  'Historical default prices stay immutable so past sales remain auditable.': {
    id: 'Riwayat harga default tetap tidak berubah agar penjualan terdahulu tetap dapat diaudit.',
    en: 'Historical default prices stay immutable so past sales remain auditable.',
  },
  'Current default price': { id: 'Harga default saat ini', en: 'Current default price' },
  'Rows per page': { id: 'Baris per halaman', en: 'Rows per page' },
  Page: { id: 'Halaman', en: 'Page' },
  Previous: { id: 'Sebelumnya', en: 'Previous' },
  Next: { id: 'Berikutnya', en: 'Next' },
  'Category added.': { id: 'Kategori berhasil ditambahkan.', en: 'Category added.' },
  'Category updated.': { id: 'Kategori berhasil diperbarui.', en: 'Category updated.' },
  'Variant added.': { id: 'Varian berhasil ditambahkan.', en: 'Variant added.' },
  'Variant updated.': { id: 'Varian berhasil diperbarui.', en: 'Variant updated.' },
  'Could not save category.': { id: 'Kategori tidak dapat disimpan.', en: 'Could not save category.' },
  'Could not save variant.': { id: 'Varian tidak dapat disimpan.', en: 'Could not save variant.' },
  'Tax to set aside': { id: 'Pajak yang perlu disisihkan', en: 'Tax to set aside' },
  'Tax by item': { id: 'Pajak per item', en: 'Tax by item' },
  Variant: { id: 'Varian', en: 'Variant' },
  Quantity: { id: 'Kuantitas', en: 'Quantity' },
};

export function useCatalogLocalization() {
  const base = useBackofficeLocalization();
  return {
    ...base,
    copy: (value: string) => catalogCopy[value]?.[base.locale] ?? base.copy(value),
  };
}
