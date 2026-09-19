import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const dashboardCopy = {
  activeBranch: { id: 'Cabang aktif', en: 'Active branch' },
  mainBranch: { id: 'Cabang utama', en: 'Main branch' },
  seeAll: { id: 'Lihat semua', en: 'See all' },
  incomeToday: { id: 'Pemasukan hari ini', en: "Today's income" },
  expensesToday: { id: 'Pengeluaran hari ini', en: "Today's expenses" },
  netRevenueToday: { id: 'Pendapatan bersih hari ini', en: "Today's net revenue" },
  transactionsToday: { id: 'Total transaksi hari ini', en: "Today's total transactions" },
  vsYesterday: { id: 'dibanding kemarin', en: 'vs yesterday' },
  activity: { id: 'Aktivitas', en: 'Activity' },
  transactionMovement: {
    id: 'Pergerakan pendapatan dan transaksi',
    en: 'Revenue and transaction movement',
  },
  today: { id: 'Hari ini', en: 'Today' },
  last7Days: { id: '7 hari terakhir', en: 'Last 7 days' },
  thisMonth: { id: 'Bulan ini', en: 'This month' },
  thisYear: { id: 'Tahun ini', en: 'This year' },
  revenue: { id: 'Pendapatan', en: 'Revenue' },
  transactions: { id: 'Transaksi', en: 'Transactions' },
  sold: { id: 'terjual', en: 'sold' },
  txShort: { id: 'trx', en: 'tx' },
  noActivity: {
    id: 'Belum ada aktivitas.',
    en: 'No activity has been recorded yet.',
  },
  summaryLoading: { id: 'Memuat ringkasan hari ini…', en: "Loading today's summary…" },
  summaryError: {
    id: 'Ringkasan hari ini tidak dapat dimuat.',
    en: "Today's summary could not be loaded.",
  },
  activityError: {
    id: 'Aktivitas terbaru tidak dapat dimuat.',
    en: 'Recent activity could not be loaded.',
  },
  transactionCompletion: { id: 'Penyelesaian transaksi', en: 'Transaction completion' },
  finalizedSalesToday: { id: 'Transaksi selesai hari ini', en: 'Completed sales today' },
  finalized: { id: 'Selesai', en: 'Completed' },
  inProgress: { id: 'Dikerjakan', en: 'In progress' },
  voided: { id: 'Dibatalkan', en: 'Voided' },
  finalizedOf: { id: 'selesai', en: 'completed' },
  topItems: { id: '5 item teratas', en: 'Top 5 items' },
  topEmployees: { id: '5 karyawan teratas', en: 'Top 5 employees' },
  paymentMix: { id: 'Komposisi pembayaran', en: 'Payment mix' },
  paymentShare: { id: 'Porsi berdasarkan nilai transaksi', en: 'Share by transaction value' },
  totalValue: { id: 'total nilai', en: 'total value' },
  lastTransactions: { id: 'Transaksi terakhir', en: 'Last transactions' },
  latest: { id: 'Terbaru', en: 'Latest' },
  businessInsight: { id: 'Ringkasan bisnis', en: 'Business summary' },
  insightComparison: {
    id: 'Bulan ini dibanding bulan sebelumnya',
    en: 'This month compared with the previous month',
  },
  insightSource: {
    id: 'Berdasarkan ringkasan laporan bulan ini.',
    en: 'Based on this month reporting summary.',
  },
  noSummary: {
    id: 'Belum ada data ringkasan untuk bulan ini.',
    en: 'No summary data is available for this month.',
  },
  noRecentTransactions: {
    id: 'Belum ada transaksi dalam 30 hari terakhir.',
    en: 'No transactions have been recorded in the last 30 days.',
  },
  salesUnavailable: { id: 'Ringkasan penjualan tidak tersedia', en: 'Sales reporting unavailable' },
  salesUnavailableDescription: {
    id: 'Anda tidak memiliki akses ke ringkasan penjualan.',
    en: 'You do not have access to sales summary data.',
  },
  selectLocation: { id: 'Pilih cabang', en: 'Select a branch' },
  selectLocationDescription: {
    id: 'Pilih cabang sebelum memuat ringkasan dasbor.',
    en: 'Choose a branch before loading dashboard summaries.',
  },
  revenueHigher: { id: 'Pendapatan lebih tinggi', en: 'Revenue is higher' },
  revenueLower: { id: 'Pendapatan lebih rendah', en: 'Revenue is lower' },
  transactionHigher: { id: 'Volume transaksi lebih tinggi', en: 'Transaction volume is higher' },
  transactionLower: { id: 'Volume transaksi lebih rendah', en: 'Transaction volume is lower' },
  previousMonthSuffix: { id: 'dibanding bulan sebelumnya.', en: 'than the previous month.' },
  averageTransactionValue: { id: 'Rata-rata nilai transaksi', en: 'Average transaction value' },
  leadingPayment: {
    id: 'adalah metode pembayaran utama bulan ini.',
    en: 'is the leading payment method this month.',
  },
  noRevenueMonth: {
    id: 'Belum ada pendapatan bulan ini.',
    en: 'No revenue was recorded this month.',
  },
  noTransactionsMonth: {
    id: 'Belum ada transaksi bulan ini.',
    en: 'No transactions were recorded this month.',
  },
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
