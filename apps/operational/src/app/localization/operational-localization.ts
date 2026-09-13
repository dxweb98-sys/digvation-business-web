import { useRuntime } from '@digvation/business-runtime';

const copy: Record<string, { 'id-ID': string; 'en-US': string }> = {
  Sales: { 'id-ID': 'Penjualan', 'en-US': 'Sales' },
  Sell: { 'id-ID': 'Jual', 'en-US': 'Sell' },
  Operations: { 'id-ID': 'Operasional', 'en-US': 'Operations' },
  Expenses: { 'id-ID': 'Pengeluaran', 'en-US': 'Expenses' },
  'Transaction history': { 'id-ID': 'Riwayat transaksi', 'en-US': 'Transaction history' },
  Date: { 'id-ID': 'Tanggal', 'en-US': 'Date' },
  From: { 'id-ID': 'Dari', 'en-US': 'From' },
  To: { 'id-ID': 'Sampai', 'en-US': 'To' },
  Period: { 'id-ID': 'Periode', 'en-US': 'Period' },
  Tax: { 'id-ID': 'Pajak', 'en-US': 'Tax' },
  Total: { 'id-ID': 'Total', 'en-US': 'Total' },
  Status: { 'id-ID': 'Status', 'en-US': 'Status' },
  Location: { 'id-ID': 'Lokasi', 'en-US': 'Location' },
  'Transaction number': { 'id-ID': 'Nomor transaksi', 'en-US': 'Transaction number' },
  'View transaction': { 'id-ID': 'Lihat transaksi', 'en-US': 'View transaction' },
  'No transactions match the current period.': {
    'id-ID': 'Tidak ada transaksi pada periode ini.',
    'en-US': 'No transactions match the current period.',
  },
  'Could not load transaction history.': {
    'id-ID': 'Riwayat transaksi tidak dapat dimuat.',
    'en-US': 'Could not load transaction history.',
  },
  'Try loading transaction history again.': {
    'id-ID': 'Coba muat ulang riwayat transaksi.',
    'en-US': 'Try loading transaction history again.',
  },
  'Operational transaction history for the active authorized location.': {
    'id-ID': 'Riwayat transaksi operasional untuk lokasi aktif yang diizinkan.',
    'en-US': 'Operational transaction history for the active authorized location.',
  },
  'My operational expenses': {
    'id-ID': 'Pengeluaran operasional saya',
    'en-US': 'My operational expenses',
  },
  'Expenses submitted from Operational for the active authorized location.': {
    'id-ID': 'Pengeluaran yang diajukan dari Operasional untuk lokasi aktif yang diizinkan.',
    'en-US': 'Expenses submitted from Operational for the active authorized location.',
  },
  'New expense': { 'id-ID': 'Pengeluaran baru', 'en-US': 'New expense' },
  Amount: { 'id-ID': 'Jumlah', 'en-US': 'Amount' },
  Category: { 'id-ID': 'Kategori', 'en-US': 'Category' },
  Account: { 'id-ID': 'Akun', 'en-US': 'Account' },
  Note: { 'id-ID': 'Catatan', 'en-US': 'Note' },
  Save: { 'id-ID': 'Simpan', 'en-US': 'Save' },
  Cancel: { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  'No operational expenses yet.': {
    'id-ID': 'Belum ada pengeluaran operasional.',
    'en-US': 'No operational expenses yet.',
  },
  'Could not load expenses.': {
    'id-ID': 'Pengeluaran tidak dapat dimuat.',
    'en-US': 'Could not load expenses.',
  },
  'Try loading expenses again.': {
    'id-ID': 'Coba muat ulang pengeluaran.',
    'en-US': 'Try loading expenses again.',
  },
  'Expense submitted.': { 'id-ID': 'Pengeluaran diajukan.', 'en-US': 'Expense submitted.' },
  'Could not submit expense.': {
    'id-ID': 'Pengeluaran tidak dapat diajukan.',
    'en-US': 'Could not submit expense.',
  },
  'Active branch': { 'id-ID': 'Cabang aktif', 'en-US': 'Active branch' },
  'Choose branch': { 'id-ID': 'Pilih cabang', 'en-US': 'Choose branch' },
  'Loading branch': { 'id-ID': 'Memuat cabang', 'en-US': 'Loading branch' },
  'Choose active branch': { 'id-ID': 'Pilih cabang aktif', 'en-US': 'Choose active branch' },
  'Select the location used for your active operation.': {
    'id-ID': 'Pilih lokasi yang digunakan untuk operasi aktif Anda.',
    'en-US': 'Select the location used for your active operation.',
  },
  'Loading branches...': { 'id-ID': 'Memuat cabang...', 'en-US': 'Loading branches...' },
  'No active branches are available for this workspace.': {
    'id-ID': 'Tidak ada cabang aktif yang tersedia untuk ruang kerja ini.',
    'en-US': 'No active branches are available for this workspace.',
  },
  Close: { 'id-ID': 'Tutup', 'en-US': 'Close' },
  Logout: { 'id-ID': 'Keluar', 'en-US': 'Logout' },
};

export function useOperationalLocalization() {
  const runtime = useRuntime();
  const locale = runtime.locale === 'en-US' ? 'en-US' : 'id-ID';
  return {
    locale,
    copy: (value: string) => copy[value]?.[locale] ?? value,
    formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, options).format(value),
    formatMoney: (amount: string, currency: string) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(amount)),
  };
}
