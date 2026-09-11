import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const dashboardCopy = {
  activeBranch: { id: 'Cabang aktif', en: 'Active branch' },
  mainBranch: { id: 'Cabang Utama', en: 'Main Branch' },
  seeAll: { id: 'Lihat semua', en: 'See all' },
  revenueToday: { id: 'Pendapatan hari ini', en: 'Revenue today' },
  transactionsToday: { id: 'Transaksi hari ini', en: 'Transactions today' },
  averageTransactionToday: { id: 'Rata-rata transaksi hari ini', en: 'Average transaction today' },
  quantitySoldToday: { id: 'Jumlah terjual hari ini', en: 'Quantity sold today' },
  vsYesterday: { id: 'dibanding kemarin', en: 'vs yesterday' },
  transactionActivity: { id: 'Aktivitas transaksi', en: 'Transaction activity' },
  transactionMovement: { id: 'Pergerakan pendapatan dan transaksi', en: 'Revenue and transaction movement' },
  today: { id: 'Hari ini', en: 'Today' },
  last7Days: { id: '7 hari terakhir', en: 'Last 7 days' },
  thisMonth: { id: 'Bulan ini', en: 'This month' },
  thisYear: { id: 'Tahun ini', en: 'This year' },
  revenue: { id: 'Pendapatan', en: 'Revenue' },
  transactions: { id: 'Transaksi', en: 'Transactions' },
  sold: { id: 'terjual', en: 'sold' },
  txShort: { id: 'trx', en: 'tx' },
  noActivity: { id: 'Belum ada aktivitas pada periode ini.', en: 'No activity has been recorded for this period yet.' },
  transactionCompletion: { id: 'Penyelesaian transaksi', en: 'Transaction completion' },
  finalizedSalesToday: { id: 'Transaksi final hari ini', en: 'Finalized sales today' },
  finalized: { id: 'Final', en: 'Finalized' },
  inProgress: { id: 'Berjalan', en: 'In progress' },
  voided: { id: 'Dibatalkan', en: 'Voided' },
  finalizedOf: { id: 'difinalisasi', en: 'finalized' },
  topItems: { id: '5 item teratas', en: 'Top 5 items' },
  topEmployees: { id: '5 karyawan teratas', en: 'Top 5 employees' },
  paymentMix: { id: 'Komposisi pembayaran', en: 'Payment mix' },
  paymentShare: { id: 'Porsi berdasarkan nilai transaksi', en: 'Share by transaction value' },
  totalValue: { id: 'total nilai', en: 'total value' },
  lastTransactions: { id: 'Transaksi terakhir', en: 'Last transactions' },
  latest: { id: 'Terbaru', en: 'Latest' },
  businessInsight: { id: 'Insight bisnis', en: 'Business insight' },
  insightComparison: { id: 'Bulan ini dibanding bulan sebelumnya', en: 'This month compared with the previous month' },
  insightSource: { id: 'Dihasilkan dari agregat laporan tanpa biaya model AI eksternal.', en: 'Generated from report aggregates only. No external AI request or model cost is used.' },
  noSummary: { id: 'Belum ada data ringkasan untuk bulan ini.', en: 'No summary data is available for this month.' },
  noRecentTransactions: { id: 'Belum ada transaksi dalam 30 hari terakhir.', en: 'No transactions have been recorded in the last 30 days.' },
  salesUnavailable: { id: 'Ringkasan penjualan tidak tersedia', en: 'Sales reporting unavailable' },
  salesUnavailableDescription: { id: 'Peran Anda tidak memiliki izin untuk membaca ringkasan penjualan.', en: 'Your role does not include permission to read sales summary data.' },
  selectLocation: { id: 'Pilih cabang', en: 'Select a location' },
  selectLocationDescription: { id: 'Pilih satu cabang yang diizinkan sebelum memuat ringkasan dasbor.', en: 'Choose one authorized branch before loading dashboard summaries.' },
  revenueHigher: { id: 'Pendapatan lebih tinggi', en: 'Revenue is higher' },
  revenueLower: { id: 'Pendapatan lebih rendah', en: 'Revenue is lower' },
  transactionHigher: { id: 'Volume transaksi lebih tinggi', en: 'Transaction volume is higher' },
  transactionLower: { id: 'Volume transaksi lebih rendah', en: 'Transaction volume is lower' },
  previousMonthSuffix: { id: 'dibanding bulan sebelumnya.', en: 'than the previous month.' },
  averageTransactionValue: { id: 'Rata-rata nilai transaksi', en: 'Average transaction value' },
  leadingPayment: { id: 'adalah metode pembayaran utama bulan ini.', en: 'is the leading payment method this month.' },
  noRevenueMonth: { id: 'Belum ada pendapatan yang tercatat bulan ini.', en: 'No revenue activity was recorded this month.' },
  noTransactionsMonth: { id: 'Belum ada transaksi yang tercatat bulan ini.', en: 'No transactions were recorded this month.' },
} as const;

export type DashboardCopyKey = keyof typeof dashboardCopy;

export function useDashboardI18n() {
  const { locale } = useBackofficeLocalization();
  return {
    locale,
    text(key: DashboardCopyKey) {
      return dashboardCopy[key][locale];
    },
  };
}
