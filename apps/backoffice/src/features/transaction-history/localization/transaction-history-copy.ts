/** Every Transaction History string, intentionally in both Backoffice languages. */
export const transactionHistoryCopy: Record<string, { id: string; en: string }> = {
  // Page and list
  'Transaction history': { id: 'Riwayat transaksi', en: 'Transaction history' },
  'Review transactions, payments, and work status.': {
    id: 'Tinjau transaksi, pembayaran, dan status pengerjaan.',
    en: 'Review transactions, payments, and work status.',
  },
  'Search number, reference, or location...': {
    id: 'Cari nomor, referensi, atau lokasi...',
    en: 'Search number, reference, or location...',
  },
  Date: { id: 'Tanggal', en: 'Date' },
  'Transaction number': { id: 'Nomor transaksi', en: 'Transaction number' },
  Total: { id: 'Total', en: 'Total' },
  'Transaction status': { id: 'Status transaksi', en: 'Transaction status' },
  Payment: { id: 'Pembayaran', en: 'Payment' },
  Work: { id: 'Pengerjaan', en: 'Work' },
  'Payment status': { id: 'Status pembayaran', en: 'Payment status' },
  'Work status': { id: 'Status pengerjaan', en: 'Work status' },
  'View transaction': { id: 'Lihat transaksi', en: 'View transaction' },
  'No transactions match the current filters.': {
    id: 'Tidak ada transaksi yang sesuai dengan filter.',
    en: 'No transactions match the current filters.',
  },
  'Could not load transaction history.': {
    id: 'Riwayat transaksi tidak dapat dimuat.',
    en: 'Could not load transaction history.',
  },
  'Try loading transaction history again.': {
    id: 'Coba muat ulang riwayat transaksi.',
    en: 'Try loading transaction history again.',
  },

  // Transaction status
  Open: { id: 'Berjalan', en: 'Open' },
  Completed: { id: 'Selesai', en: 'Completed' },
  Cancelled: { id: 'Dibatalkan', en: 'Cancelled' },
  Reversed: { id: 'Direversal', en: 'Reversed' },

  // Payment summary
  'Not paid': { id: 'Belum dibayar', en: 'Not paid' },
  'No payment': { id: 'Tanpa pembayaran', en: 'No payment' },
  'Nothing to pay': { id: 'Tidak ada tagihan', en: 'Nothing to pay' },
  'Payment pending': { id: 'Menunggu pembayaran', en: 'Payment pending' },
  'Partially paid': { id: 'Dibayar sebagian', en: 'Partially paid' },
  Paid: { id: 'Lunas', en: 'Paid' },
  'Paid (split)': { id: 'Lunas (pembayaran terpisah)', en: 'Paid (split)' },
  'Partially refunded': { id: 'Dikembalikan sebagian', en: 'Partially refunded' },
  Refunded: { id: 'Dikembalikan', en: 'Refunded' },

  // Payment attempts (raw statuses, used by the attempt filter and attempt history)
  Pending: { id: 'Menunggu', en: 'Pending' },
  Succeeded: { id: 'Berhasil', en: 'Succeeded' },
  Failed: { id: 'Gagal', en: 'Failed' },
  Expired: { id: 'Kedaluwarsa', en: 'Expired' },

  // Work summary
  'No tracked work': { id: 'Tanpa pengerjaan', en: 'No tracked work' },
  'Not submitted': { id: 'Belum dikirim', en: 'Not submitted' },
  Waiting: { id: 'Menunggu', en: 'Waiting' },
  'In progress': { id: 'Dikerjakan', en: 'In progress' },

  // Payment methods
  Cash: { id: 'Tunai', en: 'Cash' },
  'Bank transfer': { id: 'Transfer bank', en: 'Bank transfer' },
  'E-wallet': { id: 'Dompet digital', en: 'E-wallet' },
  QRIS: { id: 'QRIS', en: 'QRIS' },

  // Detail
  'Transaction details': { id: 'Detail transaksi', en: 'Transaction details' },
  'Loading transaction details...': {
    id: 'Memuat detail transaksi...',
    en: 'Loading transaction details...',
  },
  'Could not load transaction details.': {
    id: 'Detail transaksi tidak dapat dimuat.',
    en: 'Could not load transaction details.',
  },
  'Close this dialog and try again.': {
    id: 'Tutup dialog ini lalu coba lagi.',
    en: 'Close this dialog and try again.',
  },
  Invoice: { id: 'Faktur', en: 'Invoice' },
  Customer: { id: 'Pelanggan', en: 'Customer' },
  Member: { id: 'Member', en: 'Member' },
  'Transaction items': { id: 'Item transaksi', en: 'Transaction items' },
  Service: { id: 'Layanan', en: 'Service' },
  Product: { id: 'Produk', en: 'Product' },
  Qty: { id: 'Jml', en: 'Qty' },
  each: { id: 'per item', en: 'each' },
  'per unit': { id: 'per unit', en: 'per unit' },
  Discount: { id: 'Diskon', en: 'Discount' },
  'Worked by': { id: 'Dikerjakan oleh', en: 'Worked by' },
  'Sold by': { id: 'Dijual oleh', en: 'Sold by' },
  Unit: { id: 'Unit', en: 'Unit' },
  'Not assigned': { id: 'Belum ditugaskan', en: 'Not assigned' },
  'Unknown employee': { id: 'Karyawan tidak dikenal', en: 'Unknown employee' },
  'Additional items': { id: 'Item tambahan', en: 'Additional items' },
  'Included in service price': { id: 'Termasuk harga layanan', en: 'Included in service price' },
  'Price breakdown': { id: 'Rincian harga', en: 'Price breakdown' },
  'Service price': { id: 'Harga layanan', en: 'Service price' },
  Included: { id: 'Termasuk', en: 'Included' },
  'Item total': { id: 'Total item', en: 'Item total' },
  'Removed or corrected items': {
    id: 'Item yang dihapus atau dikoreksi',
    en: 'Removed or corrected items',
  },
  'Not part of the billed total.': {
    id: 'Tidak termasuk dalam total tagihan.',
    en: 'Not part of the billed total.',
  },
  Charges: { id: 'Rincian tagihan', en: 'Billing details' },
  Subtotal: { id: 'Subtotal', en: 'Subtotal' },
  'Loyalty redemption': { id: 'Penukaran poin', en: 'Loyalty redemption' },
  points: { id: 'poin', en: 'points' },
  Tax: { id: 'Pajak', en: 'Tax' },
  Payments: { id: 'Pembayaran', en: 'Payments' },
  'No payments recorded yet.': { id: 'Belum ada pembayaran.', en: 'No payments recorded yet.' },
  'Total paid': { id: 'Total dibayar', en: 'Total paid' },
  'Total refunded': { id: 'Total dikembalikan', en: 'Total refunded' },
  'Balance due': { id: 'Sisa tagihan', en: 'Balance due' },
  'Cash received': { id: 'Uang diterima', en: 'Cash received' },
  Change: { id: 'Kembalian', en: 'Change' },
  Reference: { id: 'Referensi', en: 'Reference' },
  Refunds: { id: 'Pengembalian dana', en: 'Refunds' },
  'Refund of': { id: 'Pengembalian untuk', en: 'Refund of' },
  'Other payment attempts': { id: 'Percobaan pembayaran lain', en: 'Other payment attempts' },
  'Not counted toward the transaction payment.': {
    id: 'Tidak dihitung dalam pembayaran transaksi.',
    en: 'Not counted toward the transaction payment.',
  },
  Reversal: { id: 'Reversal', en: 'Reversal' },
  Reason: { id: 'Alasan', en: 'Reason' },
  'Reversed on': { id: 'Direversal pada', en: 'Reversed on' },
  Close: { id: 'Tutup', en: 'Close' },
  Cancel: { id: 'Batal', en: 'Cancel' },

  // Refund
  Refund: { id: 'Kembalikan dana', en: 'Refund' },
  'Refund payment': { id: 'Kembalikan pembayaran', en: 'Refund payment' },
  'Payment to refund': { id: 'Pembayaran yang dikembalikan', en: 'Payment to refund' },
  'Select a payment': { id: 'Pilih pembayaran', en: 'Select a payment' },
  'Refund amount': { id: 'Jumlah pengembalian', en: 'Refund amount' },
  'Refundable up to': { id: 'Dapat dikembalikan hingga', en: 'Refundable up to' },
  'Enter an amount up to the refundable balance.': {
    id: 'Masukkan jumlah hingga sisa yang dapat dikembalikan.',
    en: 'Enter an amount up to the refundable balance.',
  },
  'Only cash payments can be refunded here. Payments through a provider are refunded in that provider’s own flow.':
    {
      id: 'Hanya pembayaran tunai yang dapat dikembalikan di sini. Pembayaran melalui penyedia dikembalikan lewat alur penyedia tersebut.',
      en: 'Only cash payments can be refunded here. Payments through a provider are refunded in that provider’s own flow.',
    },
  'Payment refunded.': { id: 'Dana berhasil dikembalikan.', en: 'Payment refunded.' },
  'Could not refund this payment.': {
    id: 'Pembayaran ini tidak dapat dikembalikan.',
    en: 'Could not refund this payment.',
  },

  // Reverse
  'Reverse transaction': { id: 'Reversal transaksi', en: 'Reverse transaction' },
  'For example, Customer returned the item': {
    id: 'Contoh: Pelanggan mengembalikan barang',
    en: 'For example, Customer returned the item',
  },
  'All successful payments must be fully refunded before this transaction can be reversed.': {
    id: 'Semua pembayaran yang berhasil harus dikembalikan penuh sebelum transaksi ini dapat direversal.',
    en: 'All successful payments must be fully refunded before this transaction can be reversed.',
  },
  'Transaction reversed.': { id: 'Transaksi berhasil direversal.', en: 'Transaction reversed.' },
  'Could not reverse this transaction.': {
    id: 'Transaksi ini tidak dapat direversal.',
    en: 'Could not reverse this transaction.',
  },

  // Promotions and discounts
  'Applied discounts': { id: 'Diskon yang diterapkan', en: 'Applied discounts' },
  Promotion: { id: 'Promo', en: 'Promotion' },
  'Manual discount': { id: 'Diskon manual', en: 'Manual discount' },
  Item: { id: 'Item', en: 'Item' },
  Category: { id: 'Kategori', en: 'Category' },
  'Whole transaction': { id: 'Seluruh transaksi', en: 'Whole transaction' },
  'Promo code': { id: 'Kode promo', en: 'Promo code' },

  // Membership and points
  'Membership & points': { id: 'Member & poin', en: 'Membership & points' },
  'Points used': { id: 'Poin digunakan', en: 'Points used' },
  'Not used': { id: 'Tidak digunakan', en: 'Not used' },
  'Redemption value': { id: 'Nilai penukaran', en: 'Redemption value' },
  'Points earned': { id: 'Poin diperoleh', en: 'Points earned' },
  'Estimated points': { id: 'Estimasi poin', en: 'Estimated points' },
  'No points earned': { id: 'Tidak ada poin', en: 'No points earned' },
  'Balance after transaction': { id: 'Saldo setelah transaksi', en: 'Balance after transaction' },
  'Final points are recorded when the transaction is completed.': {
    id: 'Poin final dicatat saat transaksi selesai.',
    en: 'Final points are recorded when the transaction is completed.',
  },
  'This transaction was reversed; the points it earned and used have been compensated.': {
    id: 'Transaksi ini telah direversal; poin yang diperoleh dan digunakan sudah dikompensasi.',
    en: 'This transaction was reversed; the points it earned and used have been compensated.',
  },

  // Reverse eligibility and action errors
  'Refund all completed payments before reversing this transaction.': {
    id: 'Kembalikan semua pembayaran yang berhasil sebelum mereversal transaksi ini.',
    en: 'Refund all completed payments before reversing this transaction.',
  },
  'Resolve the pending payment before reversing this transaction.': {
    id: 'Selesaikan pembayaran yang masih menunggu sebelum mereversal transaksi ini.',
    en: 'Resolve the pending payment before reversing this transaction.',
  },
  'Non-cash payments must be refunded through their provider, so this transaction can’t be reversed here yet.':
    {
      id: 'Pembayaran non-tunai harus dikembalikan melalui penyedianya, sehingga transaksi ini belum dapat direversal di sini.',
      en: 'Non-cash payments must be refunded through their provider, so this transaction can’t be reversed here yet.',
    },
  'Only a completed transaction can be reversed.': {
    id: 'Hanya transaksi yang sudah selesai yang dapat direversal.',
    en: 'Only a completed transaction can be reversed.',
  },
  'This transaction has already been reversed.': {
    id: 'Transaksi ini sudah direversal.',
    en: 'This transaction has already been reversed.',
  },
  'This transaction changed in the meantime. Reload it and try again.': {
    id: 'Transaksi ini telah berubah. Muat ulang lalu coba lagi.',
    en: 'This transaction changed in the meantime. Reload it and try again.',
  },
  'This payment went through a provider and must be refunded in that provider’s flow.': {
    id: 'Pembayaran ini melalui penyedia dan harus dikembalikan lewat alur penyedia tersebut.',
    en: 'This payment went through a provider and must be refunded in that provider’s flow.',
  },
  'The amount is more than what is left to refund on this payment.': {
    id: 'Jumlah melebihi sisa yang dapat dikembalikan dari pembayaran ini.',
    en: 'The amount is more than what is left to refund on this payment.',
  },
  'Only payments of a completed transaction can be refunded.': {
    id: 'Hanya pembayaran dari transaksi yang sudah selesai yang dapat dikembalikan.',
    en: 'Only payments of a completed transaction can be refunded.',
  },
  'Enter a refund amount greater than zero.': {
    id: 'Masukkan jumlah pengembalian lebih dari nol.',
    en: 'Enter a refund amount greater than zero.',
  },
  'This payment can no longer be refunded.': {
    id: 'Pembayaran ini tidak dapat dikembalikan lagi.',
    en: 'This payment can no longer be refunded.',
  },
  'Try again': { id: 'Coba lagi', en: 'Try again' },
};
