import { useOperationalLocalization } from '../../app/localization/operational-localization';

const copy: Record<string, string> = {
  Customers: 'Pelanggan',
  'Regular Customer': 'Pelanggan Umum',
  All: 'Semua',
  'Customer detail': 'Detail pelanggan',
  'Browse customers and their recent transactions.':
    'Lihat pelanggan dan transaksi terakhir mereka.',
  'Search name or phone': 'Cari nama atau telepon',
  'Customer type': 'Jenis pelanggan',
  'No customers yet.': 'Belum ada pelanggan.',
  'No customers match your search.': 'Pelanggan tidak ditemukan.',
  'Could not load customers.': 'Pelanggan gagal dimuat.',
  'Try loading customers again.': 'Coba muat pelanggan kembali.',
  'Could not load customer detail.': 'Detail pelanggan gagal dimuat.',
  'Customer profile updated.': 'Profil pelanggan diperbarui.',
  'Could not update the customer profile.':
    'Profil pelanggan gagal diperbarui. Periksa nama dan nomor telepon.',
  'Recent transactions': 'Transaksi terakhir',
  'No finalized transactions yet.': 'Belum ada transaksi selesai.',
  Showing: 'Menampilkan',
  'most recent transactions': 'transaksi terakhir',
};
export function useCustomerLocalization() {
  const base = useOperationalLocalization();
  return {
    ...base,
    copy: (value: string) => (base.locale === 'id-ID' ? (copy[value] ?? base.copy(value)) : value),
  };
}
