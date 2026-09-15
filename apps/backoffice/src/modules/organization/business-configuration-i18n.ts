import { useCallback } from 'react';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const configurationCopy: Record<string, { id: string; en: string }> = {
  Configuration: { id: 'Konfigurasi', en: 'Configuration' },
  Business: { id: 'Bisnis', en: 'Business' },
  'Manage business identity, locations, localization, and automatic numbering from one authoritative configuration.':
    {
      id: 'Kelola profil bisnis, lokasi, bahasa, dan penomoran.',
      en: 'Manage the business profile, locations, language, and numbering.',
    },
  Profile: { id: 'Profil', en: 'Profile' },
  Locations: { id: 'Lokasi', en: 'Locations' },
  Localization: { id: 'Bahasa dan waktu', en: 'Language and time' },
  Numbering: { id: 'Penomoran', en: 'Numbering' },
  'Business profile': { id: 'Profil bisnis', en: 'Business profile' },
  'This identity is the tenant business authority used by Backoffice and Operational.': {
    id: 'Profil bisnis digunakan di Backoffice dan Operational.',
    en: 'The business profile is used in Backoffice and Operational.',
  },
  'Edit profile': { id: 'Ubah profil', en: 'Edit profile' },
  'Not configured': { id: 'Belum diatur', en: 'Not configured' },
  'Update the business identity consumed by authenticated applications.': {
    id: 'Perbarui informasi bisnis.',
    en: 'Update business information.',
  },
  'Business name': { id: 'Nama bisnis', en: 'Business name' },
  Cancel: { id: 'Batal', en: 'Cancel' },
  'Save profile': { id: 'Simpan profil', en: 'Save profile' },
  'Business profile updated.': { id: 'Profil bisnis diperbarui.', en: 'Business profile updated.' },
  'Could not update business profile.': {
    id: 'Profil bisnis tidak dapat diperbarui.',
    en: 'Could not update business profile.',
  },
  'Persisted values become the tenant default and are applied after save.': {
    id: 'Pengaturan ini berlaku setelah disimpan.',
    en: 'These settings apply after they are saved.',
  },
  'Edit localization': { id: 'Ubah bahasa dan waktu', en: 'Edit language and time' },
  'Default language': { id: 'Bahasa default', en: 'Default language' },
  Timezone: { id: 'Zona waktu', en: 'Timezone' },
  'Date format': { id: 'Format tanggal', en: 'Date format' },
  'Time format': { id: 'Format waktu', en: 'Time format' },
  Indonesian: { id: 'Bahasa Indonesia', en: 'Indonesian' },
  English: { id: 'Bahasa Inggris', en: 'English' },
  '24-hour (HH:mm)': { id: '24 jam (HH:mm)', en: '24-hour (HH:mm)' },
  '12-hour (hh:mm a)': { id: '12 jam (hh:mm a)', en: '12-hour (hh:mm a)' },
  'Save localization': { id: 'Simpan pengaturan', en: 'Save settings' },
  'Localization updated.': {
    id: 'Pengaturan bahasa diperbarui.',
    en: 'Language settings updated.',
  },
  'Could not update localization.': {
    id: 'Pengaturan bahasa tidak dapat diperbarui.',
    en: 'Could not update language settings.',
  },
  'Selling location': { id: 'Lokasi penjualan', en: 'Selling location' },
  Code: { id: 'Kode', en: 'Code' },
  Status: { id: 'Status', en: 'Status' },
  Active: { id: 'Aktif', en: 'Active' },
  Inactive: { id: 'Tidak aktif', en: 'Inactive' },
  'Main Branch': { id: 'Cabang utama', en: 'Main branch' },
  'Add location': { id: 'Tambah lokasi', en: 'Add location' },
  'Edit selling location': { id: 'Ubah lokasi penjualan', en: 'Edit selling location' },
  'Deactivate selling location': {
    id: 'Nonaktifkan lokasi penjualan',
    en: 'Deactivate selling location',
  },
  'No selling locations have been created yet.': {
    id: 'Belum ada lokasi penjualan.',
    en: 'No selling locations have been created yet.',
  },
  'Deactivate selling location?': {
    id: 'Nonaktifkan lokasi penjualan?',
    en: 'Deactivate selling location?',
  },
  'This location remains in historical records but cannot be used for new operations.': {
    id: 'Lokasi tetap tersimpan dalam riwayat, tetapi tidak dapat digunakan untuk transaksi baru.',
    en: 'The location remains in history but cannot be used for new transactions.',
  },
  Deactivate: { id: 'Nonaktifkan', en: 'Deactivate' },
  'Add selling location': { id: 'Tambah lokasi penjualan', en: 'Add selling location' },
  'Location code': { id: 'Kode lokasi', en: 'Location code' },
  'Use as Main Branch': { id: 'Jadikan cabang utama', en: 'Use as main branch' },
  'Save location': { id: 'Simpan lokasi', en: 'Save location' },
  'Selling location added.': { id: 'Lokasi penjualan ditambahkan.', en: 'Selling location added.' },
  'Selling location updated.': {
    id: 'Lokasi penjualan diperbarui.',
    en: 'Selling location updated.',
  },
  'Selling location deactivated.': {
    id: 'Lokasi penjualan dinonaktifkan.',
    en: 'Selling location deactivated.',
  },
  'Could not save selling location.': {
    id: 'Lokasi penjualan tidak dapat disimpan.',
    en: 'Could not save selling location.',
  },
  'Automatic codes': { id: 'Kode otomatis', en: 'Automatic codes' },
  'When a code is left empty, Runtime uses this prefix and the next tenant sequence. Existing codes never change and the sequence cannot be reset here.':
    {
      id: 'Jika kode dikosongkan, sistem membuat kode berikutnya secara otomatis. Kode yang sudah ada tidak berubah.',
      en: 'When a code is left empty, the system creates the next code automatically. Existing codes do not change.',
    },
  Product: { id: 'Produk', en: 'Product' },
  Service: { id: 'Layanan', en: 'Service' },
  Category: { id: 'Kategori', en: 'Category' },
  Variant: { id: 'Varian', en: 'Variant' },
  Employee: { id: 'Karyawan', en: 'Employee' },
  'Employee Position': { id: 'Jabatan karyawan', en: 'Employee position' },
  'Sale / Transaction': { id: 'Transaksi', en: 'Transaction' },
  Invoice: { id: 'Faktur', en: 'Invoice' },
  Prefix: { id: 'Awalan', en: 'Prefix' },
  Padding: { id: 'Jumlah digit', en: 'Number of digits' },
  'Current sequence': { id: 'Nomor saat ini', en: 'Current number' },
  'Next example': { id: 'Contoh berikutnya', en: 'Next example' },
  Edit: { id: 'Ubah', en: 'Edit' },
  'Edit numbering': { id: 'Ubah penomoran', en: 'Edit numbering' },
  'Prefix and padding affect future automatically generated values only. Current sequence is read-only and is never reset by this change.':
    {
      id: 'Perubahan hanya berlaku untuk kode berikutnya. Nomor saat ini tidak diubah.',
      en: 'Changes apply only to future codes. The current number is not changed.',
    },
  Save: { id: 'Simpan', en: 'Save' },
  'Numbering updated.': { id: 'Penomoran diperbarui.', en: 'Numbering updated.' },
  'Could not update numbering.': {
    id: 'Penomoran tidak dapat diperbarui.',
    en: 'Could not update numbering.',
  },
  'No automatic numbering is applicable to the enabled features.': {
    id: 'Tidak ada penomoran otomatis untuk fitur yang aktif.',
    en: 'No automatic numbering applies to the enabled features.',
  },
};

export function useBusinessConfigurationI18n() {
  const { locale, copy: globalCopy } = useBackofficeLocalization();
  const copy = useCallback(
    (value: string) => configurationCopy[value]?.[locale] ?? globalCopy(value),
    [globalCopy, locale],
  );
  return { locale, copy };
}
