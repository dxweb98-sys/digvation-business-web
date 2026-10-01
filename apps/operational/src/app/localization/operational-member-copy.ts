import type { OperationalLocale } from './operational-localization';

type LocalizedCopy = Record<OperationalLocale, string>;

/** Copy for the Operational Member surface. Consulted after the shared and POS copy. */
const memberCopy: Record<string, LocalizedCopy> = {
  Customers: { 'id-ID': 'Pelanggan', 'en-US': 'Customers' },
  Members: { 'id-ID': 'Member', 'en-US': 'Members' },
  'Browse members, check their points and update profile details.': {
    'id-ID': 'Lihat member, cek poin, dan perbarui data profil.',
    'en-US': 'Browse members, check their points and update profile details.',
  },
  'Search member name, number, or phone': {
    'id-ID': 'Cari nama, nomor member, atau telepon',
    'en-US': 'Search member name, number, or phone',
  },
  'Member number': { 'id-ID': 'Nomor Member', 'en-US': 'Member number' },
  'No members yet.': { 'id-ID': 'Belum ada member.', 'en-US': 'No members yet.' },
  'No members match your search.': {
    'id-ID': 'Tidak ada member yang cocok dengan pencarian.',
    'en-US': 'No members match your search.',
  },
  'Could not load members.': {
    'id-ID': 'Daftar member tidak dapat dimuat.',
    'en-US': 'Could not load members.',
  },
  'Try loading members again.': {
    'id-ID': 'Coba muat ulang daftar member.',
    'en-US': 'Try loading members again.',
  },
  'Member detail': { 'id-ID': 'Detail Member', 'en-US': 'Member detail' },
  'Could not load member detail.': {
    'id-ID': 'Detail member tidak dapat dimuat.',
    'en-US': 'Could not load member detail.',
  },
  'Try loading the member again.': {
    'id-ID': 'Coba muat ulang data member.',
    'en-US': 'Try loading the member again.',
  },
  'Member since': { 'id-ID': 'Member sejak', 'en-US': 'Member since' },
  'Current points': { 'id-ID': 'Poin saat ini', 'en-US': 'Current points' },
  'Point activity': { 'id-ID': 'Aktivitas Poin', 'en-US': 'Point activity' },
  Transactions: { 'id-ID': 'Transaksi', 'en-US': 'Transactions' },
  'No point activity yet.': {
    'id-ID': 'Belum ada aktivitas poin.',
    'en-US': 'No point activity yet.',
  },
  'Balance after': { 'id-ID': 'Saldo setelah', 'en-US': 'Balance after' },
  'Points used': { 'id-ID': 'Poin digunakan', 'en-US': 'Points used' },
  'Earned points reversed': {
    'id-ID': 'Poin perolehan dibatalkan',
    'en-US': 'Earned points reversed',
  },
  'Used points restored': {
    'id-ID': 'Poin dikembalikan',
    'en-US': 'Used points restored',
  },
  'Migrated opening balance': {
    'id-ID': 'Saldo awal migrasi',
    'en-US': 'Migrated opening balance',
  },
  Showing: { 'id-ID': 'Menampilkan', 'en-US': 'Showing' },
  'most recent transactions': { 'id-ID': 'transaksi terbaru', 'en-US': 'most recent transactions' },
  'No completed transaction yet.': {
    'id-ID': 'Belum ada transaksi selesai.',
    'en-US': 'No completed transaction yet.',
  },
  'Points used in this transaction': {
    'id-ID': 'Poin digunakan pada transaksi ini',
    'en-US': 'Points used in this transaction',
  },
  'Points earned in this transaction': {
    'id-ID': 'Poin diperoleh dari transaksi ini',
    'en-US': 'Points earned in this transaction',
  },
  'Edit profile': { 'id-ID': 'Ubah data', 'en-US': 'Edit profile' },
  'Use the international format, for example +628123456789.': {
    'id-ID': 'Gunakan format internasional, contoh +628123456789.',
    'en-US': 'Use the international format, for example +628123456789.',
  },
  'Member profile updated.': {
    'id-ID': 'Data member diperbarui.',
    'en-US': 'Member profile updated.',
  },
  'This phone number is already registered as a member.': {
    'id-ID': 'Nomor telepon ini sudah terdaftar sebagai member.',
    'en-US': 'This phone number is already registered as a member.',
  },
  'Could not update the member profile. Check the name and phone number and try again.': {
    'id-ID': 'Data member tidak dapat diperbarui. Periksa nama dan nomor telepon, lalu coba lagi.',
    'en-US': 'Could not update the member profile. Check the name and phone number and try again.',
  },
};

export function operationalMemberCopy(
  value: string,
  locale: OperationalLocale,
): string | undefined {
  return memberCopy[value]?.[locale];
}
