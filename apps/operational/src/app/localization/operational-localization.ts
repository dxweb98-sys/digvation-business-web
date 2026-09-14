import { useRuntime } from '@digvation/business-runtime';

type OperationalLocale = 'id-ID' | 'en-US';
type LocalizedLabel = Record<OperationalLocale, string>;

const copy: Record<string, LocalizedLabel> = {
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
    'id-ID': 'Gagal memuat riwayat transaksi.',
    'en-US': 'Could not load transaction history.',
  },
  'Try loading transaction history again.': {
    'id-ID': 'Coba muat ulang riwayat transaksi.',
    'en-US': 'Try loading transaction history again.',
  },
  'Operational transaction history for the active authorized location.': {
    'id-ID': 'Riwayat transaksi untuk cabang aktif.',
    'en-US': 'Transaction history for the active branch.',
  },
  'My operational expenses': {
    'id-ID': 'Pengeluaran operasional saya',
    'en-US': 'My operational expenses',
  },
  'Expenses submitted from Operational for the active authorized location.': {
    'id-ID': 'Pengeluaran untuk cabang aktif.',
    'en-US': 'Expenses for the active branch.',
  },
  'New expense': { 'id-ID': 'Pengeluaran baru', 'en-US': 'New expense' },
  Amount: { 'id-ID': 'Jumlah', 'en-US': 'Amount' },
  Category: { 'id-ID': 'Kategori', 'en-US': 'Category' },
  Account: { 'id-ID': 'Akun', 'en-US': 'Account' },
  Email: { 'id-ID': 'Email', 'en-US': 'Email' },
  Name: { 'id-ID': 'Nama', 'en-US': 'Name' },
  Business: { 'id-ID': 'Bisnis', 'en-US': 'Business' },
  Version: { 'id-ID': 'Versi', 'en-US': 'Version' },
  Note: { 'id-ID': 'Catatan', 'en-US': 'Note' },
  Save: { 'id-ID': 'Simpan', 'en-US': 'Save' },
  Cancel: { 'id-ID': 'Batal', 'en-US': 'Cancel' },
  'Not available': { 'id-ID': 'Tidak tersedia', 'en-US': 'Not available' },
  'No operational expenses yet.': {
    'id-ID': 'Belum ada pengeluaran operasional.',
    'en-US': 'No operational expenses yet.',
  },
  'Could not load expenses.': {
    'id-ID': 'Gagal memuat pengeluaran.',
    'en-US': 'Could not load expenses.',
  },
  'Try loading expenses again.': {
    'id-ID': 'Coba muat ulang pengeluaran.',
    'en-US': 'Try loading expenses again.',
  },
  'Expense submitted.': { 'id-ID': 'Pengeluaran berhasil diajukan.', 'en-US': 'Expense submitted.' },
  'Could not submit expense.': {
    'id-ID': 'Gagal mengajukan pengeluaran.',
    'en-US': 'Could not submit expense.',
  },
  'Active branch': { 'id-ID': 'Cabang aktif', 'en-US': 'Active branch' },
  'Choose branch': { 'id-ID': 'Pilih cabang', 'en-US': 'Choose branch' },
  'Loading branch': { 'id-ID': 'Memuat cabang', 'en-US': 'Loading branch' },
  'Choose active branch': { 'id-ID': 'Pilih cabang aktif', 'en-US': 'Choose active branch' },
  'Select the location used for your active operation.': {
    'id-ID': 'Pilih cabang untuk operasional saat ini.',
    'en-US': 'Select the branch for current operations.',
  },
  'Loading branches...': { 'id-ID': 'Memuat cabang...', 'en-US': 'Loading branches...' },
  'No active branches are available for this workspace.': {
    'id-ID': 'Tidak ada cabang aktif untuk bisnis ini.',
    'en-US': 'No active branches are available for this business.',
  },
  'Changing branch leaves the current transaction open and starts a new transaction. Continue?': {
    'id-ID': 'Ganti cabang? Transaksi saat ini tetap berjalan dan transaksi baru akan dimulai.',
    'en-US': 'Change branch? The current transaction stays open and a new transaction will start.',
  },
  'Open navigation': { 'id-ID': 'Buka navigasi', 'en-US': 'Open navigation' },
  'Open account information': { 'id-ID': 'Buka informasi akun', 'en-US': 'Open account information' },
  'Account information': { 'id-ID': 'Informasi akun', 'en-US': 'Account information' },
  'Operational account information for the active session.': {
    'id-ID': 'Akun yang digunakan pada sesi ini.',
    'en-US': 'Account used for this session.',
  },
  'Request password change': { 'id-ID': 'Ubah kata sandi', 'en-US': 'Request password change' },
  Branch: { 'id-ID': 'Cabang', 'en-US': 'Branch' },
  Close: { 'id-ID': 'Tutup', 'en-US': 'Close' },
  Logout: { 'id-ID': 'Keluar', 'en-US': 'Logout' },
};

const technicalLabels: Record<string, LocalizedLabel> = {
  ONLINE: { 'id-ID': 'Online', 'en-US': 'Online' },
  OFFLINE: { 'id-ID': 'Offline', 'en-US': 'Offline' },
  ACTIVE: { 'id-ID': 'Aktif', 'en-US': 'Active' },
  INACTIVE: { 'id-ID': 'Nonaktif', 'en-US': 'Inactive' },
  DRAFT: { 'id-ID': 'Draf', 'en-US': 'Draft' },
  OPEN: { 'id-ID': 'Berjalan', 'en-US': 'Open' },
  FINALIZED: { 'id-ID': 'Selesai', 'en-US': 'Completed' },
  VOIDED: { 'id-ID': 'Dibatalkan', 'en-US': 'Voided' },
  QUEUED: { 'id-ID': 'Antrian', 'en-US': 'Queued' },
  IN_PROGRESS: { 'id-ID': 'Dikerjakan', 'en-US': 'In progress' },
  COMPLETED: { 'id-ID': 'Selesai', 'en-US': 'Completed' },
  CANCELED: { 'id-ID': 'Dibatalkan', 'en-US': 'Canceled' },
  CANCELLED: { 'id-ID': 'Dibatalkan', 'en-US': 'Cancelled' },
  PENDING: { 'id-ID': 'Menunggu', 'en-US': 'Pending' },
  WAITING: { 'id-ID': 'Menunggu', 'en-US': 'Waiting' },
  SUCCEEDED: { 'id-ID': 'Berhasil', 'en-US': 'Succeeded' },
  FAILED: { 'id-ID': 'Gagal', 'en-US': 'Failed' },
  REJECTED: { 'id-ID': 'Ditolak', 'en-US': 'Rejected' },
  APPROVED: { 'id-ID': 'Disetujui', 'en-US': 'Approved' },
  EXPIRED: { 'id-ID': 'Kedaluwarsa', 'en-US': 'Expired' },
  PRODUCT: { 'id-ID': 'Produk', 'en-US': 'Product' },
  SERVICE: { 'id-ID': 'Layanan', 'en-US': 'Service' },
  REQUIRED: { 'id-ID': 'Wajib', 'en-US': 'Required' },
  OPTIONAL: { 'id-ID': 'Opsional', 'en-US': 'Optional' },
  NONE: { 'id-ID': 'Tidak diperlukan', 'en-US': 'Not required' },
  EXACT: { 'id-ID': 'Harga tetap', 'en-US': 'Fixed price' },
  FROM: { 'id-ID': 'Mulai dari', 'en-US': 'From' },
  TRACKED: { 'id-ID': 'Perlu pengerjaan', 'en-US': 'Work tracked' },
  INSTANT: { 'id-ID': 'Langsung selesai', 'en-US': 'Instant' },
  CASH: { 'id-ID': 'Tunai', 'en-US': 'Cash' },
  BANK_TRANSFER: { 'id-ID': 'Transfer bank', 'en-US': 'Bank transfer' },
  WALLET: { 'id-ID': 'Dompet digital', 'en-US': 'E-wallet' },
  QRIS: { 'id-ID': 'QRIS', 'en-US': 'QRIS' },
  OPERATIONS: { 'id-ID': 'Operasional', 'en-US': 'Operations' },
  TRANSPORT: { 'id-ID': 'Transportasi', 'en-US': 'Transport' },
  SUPPLIES: { 'id-ID': 'Perlengkapan', 'en-US': 'Supplies' },
  OTHER: { 'id-ID': 'Lainnya', 'en-US': 'Other' },
};

function humanizeTechnicalValue(value: string): string {
  return value
    .replace(/[:_]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function useOperationalLocalization() {
  const runtime = useRuntime();
  const locale: OperationalLocale = runtime.locale === 'en-US' ? 'en-US' : 'id-ID';
  return {
    locale,
    copy: (value: string) => copy[value]?.[locale] ?? value,
    label: (value: string) => technicalLabels[value]?.[locale] ?? humanizeTechnicalValue(value),
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
