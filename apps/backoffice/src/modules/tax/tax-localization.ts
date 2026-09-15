import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const messages = {
  id: {
    pageDescription: 'Atur penerapan pajak untuk transaksi bisnis.',
    profile: 'Profil', categories: 'Kategori', rules: 'Aturan pajak',
    itemTax: 'Pajak per item', itemTaxHint: 'Terapkan aturan pajak berdasarkan kategori item.',
    transactionTax: 'Pajak transaksi', transactionTaxHint: 'Terapkan aturan pajak pada tingkat transaksi.',
    saveProfile: 'Simpan profil', profileSaved: 'Profil pajak berhasil disimpan.', profileSaveFailed: 'Profil pajak tidak dapat disimpan.',
    code: 'Kode', name: 'Nama', status: 'Status', active: 'Aktif', inactive: 'Tidak aktif', cancelled: 'Dibatalkan',
    addCategory: 'Tambah kategori', editCategory: 'Ubah kategori', categorySaved: 'Kategori pajak berhasil disimpan.', categorySaveFailed: 'Kategori pajak tidak dapat disimpan.', categoryEmpty: 'Belum ada kategori pajak.',
    save: 'Simpan', cancel: 'Batal',
    scope: 'Cakupan', category: 'Kategori', rate: 'Tarif (%)', treatment: 'Perlakuan harga', effectivity: 'Berlaku', action: 'Aksi',
    transaction: 'Transaksi', item: 'Item', included: 'Termasuk pajak', excluded: 'Di luar harga',
    addRule: 'Tambah aturan', ruleAdded: 'Aturan pajak berhasil ditambahkan.', ruleAddFailed: 'Aturan pajak tidak dapat ditambahkan.', ruleEmpty: 'Belum ada aturan pajak.',
    cancelRule: 'Batalkan aturan', cancelRuleTitle: 'Batalkan aturan pajak?', cancelRuleMessage: 'Aturan ini tidak akan digunakan untuk transaksi berikutnya.', ruleCancelled: 'Aturan pajak berhasil dibatalkan.', ruleCancelFailed: 'Aturan pajak tidak dapat dibatalkan.',
    effectiveFrom: 'Berlaku mulai', effectiveUntil: 'Berlaku sampai', optional: 'Opsional', immediate: 'Langsung', noEnd: 'Tanpa batas akhir',
    invalidPeriod: 'Berlaku sampai harus setelah Berlaku mulai.',
    conflict: 'Periode aturan bertabrakan dengan aturan aktif lain untuk cakupan yang sama.',
    inactiveReference: 'Kategori yang dipilih sudah tidak aktif.', invalidInput: 'Periksa kembali data aturan pajak.', forbidden: 'Anda tidak memiliki izin untuk tindakan ini.', serverError: 'Terjadi gangguan pada layanan. Silakan coba lagi setelah layanan siap.',
    noCategory: '—',
  },
  en: {
    pageDescription: 'Configure how tax applies to business transactions.',
    profile: 'Profile', categories: 'Categories', rules: 'Tax rules',
    itemTax: 'Item tax', itemTaxHint: 'Apply tax rules by item category.',
    transactionTax: 'Transaction tax', transactionTaxHint: 'Apply tax rules at transaction level.',
    saveProfile: 'Save profile', profileSaved: 'Tax profile saved.', profileSaveFailed: 'Could not save tax profile.',
    code: 'Code', name: 'Name', status: 'Status', active: 'Active', inactive: 'Inactive', cancelled: 'Cancelled',
    addCategory: 'Add category', editCategory: 'Edit category', categorySaved: 'Tax category saved.', categorySaveFailed: 'Could not save tax category.', categoryEmpty: 'No tax categories yet.',
    save: 'Save', cancel: 'Cancel',
    scope: 'Scope', category: 'Category', rate: 'Rate (%)', treatment: 'Price treatment', effectivity: 'Effective', action: 'Action',
    transaction: 'Transaction', item: 'Item', included: 'Tax included', excluded: 'Added to price',
    addRule: 'Add rule', ruleAdded: 'Tax rule added.', ruleAddFailed: 'Could not add tax rule.', ruleEmpty: 'No tax rules yet.',
    cancelRule: 'Cancel rule', cancelRuleTitle: 'Cancel tax rule?', cancelRuleMessage: 'This rule will no longer be used for future transactions.', ruleCancelled: 'Tax rule cancelled.', ruleCancelFailed: 'Could not cancel tax rule.',
    effectiveFrom: 'Effective from', effectiveUntil: 'Effective until', optional: 'Optional', immediate: 'Immediately', noEnd: 'No end date',
    invalidPeriod: 'Effective until must be after Effective from.',
    conflict: 'The rule period overlaps another active rule for the same scope.',
    inactiveReference: 'The selected category is no longer active.', invalidInput: 'Check the tax rule data and try again.', forbidden: 'You do not have permission for this action.', serverError: 'The service is unavailable. Try again after it is ready.',
    noCategory: '—',
  },
} as const;

export type TaxMessageKey = keyof typeof messages.id;

export function useTaxLocalization() {
  const backoffice = useBackofficeLocalization();
  const language = backoffice.locale.startsWith('id') ? 'id' : 'en';
  return {
    ...backoffice,
    tax: (key: TaxMessageKey) => messages[language][key],
  };
}
