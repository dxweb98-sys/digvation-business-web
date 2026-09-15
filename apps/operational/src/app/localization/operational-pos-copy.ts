import type { OperationalLocale } from './operational-localization';

type LocalizedCopy = Record<OperationalLocale, string>;

const posCopy: Record<string, LocalizedCopy> = {
  Transaction: { 'id-ID': 'Transaksi', 'en-US': 'Transaction' },
  Add: { 'id-ID': 'Tambah', 'en-US': 'Add' },
  From: { 'id-ID': 'Mulai', 'en-US': 'From' },
  'Item price is unavailable for this selection.': {
    'id-ID': 'Harga item belum tersedia untuk pilihan ini.',
    'en-US': 'Item price is unavailable for this selection.',
  },
  'Transaction changed. Review the latest data before continuing.': {
    'id-ID': 'Transaksi telah berubah. Tinjau data terbaru sebelum melanjutkan.',
    'en-US': 'Transaction changed. Review the latest data before continuing.',
  },
  'Transaction could not be processed. Try again.': {
    'id-ID': 'Transaksi tidak dapat diproses. Coba lagi.',
    'en-US': 'Transaction could not be processed. Try again.',
  },
  'The latest transaction could not be confirmed. Review it before continuing.': {
    'id-ID': 'Data transaksi terbaru belum dapat dipastikan. Tinjau transaksi sebelum melanjutkan.',
    'en-US': 'The latest transaction could not be confirmed. Review it before continuing.',
  },
  'The result could not be confirmed. Try again from the current transaction.': {
    'id-ID': 'Hasil tindakan belum dapat dipastikan. Coba lagi dari transaksi saat ini.',
    'en-US': 'The result could not be confirmed. Try again from the current transaction.',
  },
  'Main branch': { 'id-ID': 'Cabang utama', 'en-US': 'Main branch' },
  items: { 'id-ID': 'item', 'en-US': 'items' },
  Quantity: { 'id-ID': 'Jumlah', 'en-US': 'Quantity' },
  'Decrease quantity': { 'id-ID': 'Kurangi jumlah', 'en-US': 'Decrease quantity' },
  'Increase quantity': { 'id-ID': 'Tambah jumlah', 'en-US': 'Increase quantity' },
  'Close active cart': { 'id-ID': 'Tutup keranjang aktif', 'en-US': 'Close active cart' },
  'No transactions in this status.': {
    'id-ID': 'Tidak ada transaksi dengan status ini.',
    'en-US': 'No transactions in this status.',
  },
  'Preview details': { 'id-ID': 'Lihat detail', 'en-US': 'Preview details' },
  'Actions for': { 'id-ID': 'Tindakan untuk', 'en-US': 'Actions for' },
  'No employees assigned': { 'id-ID': 'Belum ada karyawan', 'en-US': 'No employees assigned' },
  configurations: { 'id-ID': 'konfigurasi', 'en-US': 'configurations' },
  'for all work units': { 'id-ID': 'untuk semua pengerjaan', 'en-US': 'for all work units' },
  'Not assigned': { 'id-ID': 'Belum ditentukan', 'en-US': 'Not assigned' },
  'Each service unit must have employee contribution totaling 100%.': {
    'id-ID': 'Setiap pengerjaan layanan harus memiliki total kontribusi karyawan 100%.',
    'en-US': 'Each service unit must have employee contribution totaling 100%.',
  },
  'Cart is not ready for payment': {
    'id-ID': 'Keranjang belum siap dibayar',
    'en-US': 'Cart is not ready for payment',
  },
  'Wait for changes to finish': {
    'id-ID': 'Tunggu perubahan selesai',
    'en-US': 'Wait for changes to finish',
  },
  'The cart is still syncing the latest changes.': {
    'id-ID': 'Keranjang masih menyinkronkan perubahan terbaru.',
    'en-US': 'The cart is still syncing the latest changes.',
  },
  'Could not create transaction': {
    'id-ID': 'Transaksi tidak dapat dibuat',
    'en-US': 'Could not create transaction',
  },
  'The cart is unchanged. Check the configuration or connection and try again.': {
    'id-ID': 'Keranjang tidak berubah. Periksa konfigurasi atau koneksi lalu coba lagi.',
    'en-US': 'The cart is unchanged. Check the configuration or connection and try again.',
  },
  'Transaction created': { 'id-ID': 'Transaksi dibuat', 'en-US': 'Transaction created' },
  'Added to queue and ready to start.': {
    'id-ID': 'masuk antrian dan siap dimulai.',
    'en-US': 'added to the queue and is ready to start.',
  },
  'Paid and added to queue.': {
    'id-ID': 'lunas dan masuk antrian.',
    'en-US': 'is paid and added to the queue.',
  },
  'Added to queue. Payment has not been received.': {
    'id-ID': 'masuk antrian. Pembayaran belum diterima.',
    'en-US': 'was added to the queue. Payment has not been received.',
  },
  'No work can be started': {
    'id-ID': 'Tidak ada pekerjaan yang dapat dimulai',
    'en-US': 'No work can be started',
  },
  'This transaction has no services waiting to be worked on.': {
    'id-ID': 'Transaksi ini tidak memiliki layanan yang menunggu pengerjaan.',
    'en-US': 'This transaction has no services waiting to be worked on.',
  },
  'is now being worked on.': {
    'id-ID': 'sekarang sedang dikerjakan.',
    'en-US': 'is now being worked on.',
  },
  'Could not start work': {
    'id-ID': 'Pengerjaan tidak dapat dimulai',
    'en-US': 'Could not start work',
  },
  'The transaction remains in the queue.': {
    'id-ID': 'Transaksi tetap berada dalam antrian.',
    'en-US': 'The transaction remains in the queue.',
  },
  'Complete employee assignment': {
    'id-ID': 'Lengkapi penugasan karyawan',
    'en-US': 'Complete employee assignment',
  },
  'Work assignment updated': {
    'id-ID': 'Penugasan diperbarui',
    'en-US': 'Work assignment updated',
  },
  'Employee assignments were saved for each service unit.': {
    'id-ID': 'Penugasan karyawan tersimpan untuk setiap pengerjaan layanan.',
    'en-US': 'Employee assignments were saved for each service unit.',
  },
  'Could not update work assignment': {
    'id-ID': 'Penugasan tidak dapat diperbarui',
    'en-US': 'Could not update work assignment',
  },
  'Employee assignments were not changed. Try again.': {
    'id-ID': 'Penugasan karyawan tidak berubah. Coba lagi.',
    'en-US': 'Employee assignments were not changed. Try again.',
  },
  'has been completed.': { 'id-ID': 'telah diselesaikan.', 'en-US': 'has been completed.' },
  'Could not complete transaction': {
    'id-ID': 'Transaksi tidak dapat diselesaikan',
    'en-US': 'Could not complete transaction',
  },
  'Check the transaction status and try again.': {
    'id-ID': 'Periksa status transaksi lalu coba lagi.',
    'en-US': 'Check the transaction status and try again.',
  },
  'Could not load transaction': {
    'id-ID': 'Transaksi tidak dapat dimuat',
    'en-US': 'Could not load transaction',
  },
  'Reload the transaction before accepting payment.': {
    'id-ID': 'Muat ulang transaksi sebelum menerima pembayaran.',
    'en-US': 'Reload the transaction before accepting payment.',
  },
  'Refund required': { 'id-ID': 'Pengembalian dana diperlukan', 'en-US': 'Refund required' },
  'A paid transaction must be refunded before it can be canceled.': {
    'id-ID': 'Transaksi yang sudah dibayar harus dikembalikan dananya sebelum dibatalkan.',
    'en-US': 'A paid transaction must be refunded before it can be canceled.',
  },
  'Refund the payment before canceling the transaction.': {
    'id-ID': 'Kembalikan pembayaran sebelum membatalkan transaksi.',
    'en-US': 'Refund the payment before canceling the transaction.',
  },
  'Cancellation reason saved.': {
    'id-ID': 'Alasan pembatalan disimpan.',
    'en-US': 'Cancellation reason saved.',
  },
  'Cancellation failed': { 'id-ID': 'Pembatalan gagal', 'en-US': 'Cancellation failed' },
  'The transaction was not changed. Check payment status.': {
    'id-ID': 'Transaksi tidak berubah. Periksa status pembayaran.',
    'en-US': 'The transaction was not changed. Check payment status.',
  },
  'Checkout failed': { 'id-ID': 'Pembayaran gagal', 'en-US': 'Checkout failed' },
  'Payment was not completed. The cart remains available.': {
    'id-ID': 'Pembayaran belum selesai. Keranjang tetap tersedia.',
    'en-US': 'Payment was not completed. The cart remains available.',
  },
  'The cart was not changed.': {
    'id-ID': 'Keranjang tidak berubah.',
    'en-US': 'The cart was not changed.',
  },
  'Transaction status was not changed.': {
    'id-ID': 'Status transaksi tidak berubah.',
    'en-US': 'Transaction status was not changed.',
  },
  'The balance and queue were not changed.': {
    'id-ID': 'Saldo dan antrian tidak berubah.',
    'en-US': 'The balance and queue were not changed.',
  },
  'Try same action': { 'id-ID': 'Coba lagi', 'en-US': 'Try again' },
  'Completing this transaction closes finished work.': {
    'id-ID': 'Menyelesaikan transaksi akan menutup pekerjaan yang sudah selesai.',
    'en-US': 'Completing this transaction closes finished work.',
  },
  'Employee updated': { 'id-ID': 'Karyawan diperbarui', 'en-US': 'Employee updated' },
  'Service assignment saved for this transaction.': {
    'id-ID': 'Penugasan layanan disimpan untuk transaksi ini.',
    'en-US': 'Service assignment saved for this transaction.',
  },
  'Could not update employee': {
    'id-ID': 'Karyawan tidak dapat diperbarui',
    'en-US': 'Could not update employee',
  },
  'Assignment was not changed. Try again.': {
    'id-ID': 'Penugasan tidak berubah. Coba lagi.',
    'en-US': 'Assignment was not changed. Try again.',
  },
  'Add to queue': { 'id-ID': 'Masukkan ke antrian', 'en-US': 'Add to queue' },
  'Payment total': { 'id-ID': 'Total pembayaran', 'en-US': 'Payment total' },
  'Transaction discount': { 'id-ID': 'Diskon transaksi', 'en-US': 'Transaction discount' },
  Promotion: { 'id-ID': 'Promo', 'en-US': 'Promotion' },
  'Use member points': { 'id-ID': 'Gunakan poin member', 'en-US': 'Use member points' },
  'Choose a payment method before continuing.': {
    'id-ID': 'Pilih metode pembayaran sebelum melanjutkan.',
    'en-US': 'Choose a payment method before continuing.',
  },
  'Payment can be recorded after transaction creation.': {
    'id-ID': 'Pembayaran dapat dicatat setelah transaksi dibuat.',
    'en-US': 'Payment can be recorded after transaction creation.',
  },
  'Select bank': { 'id-ID': 'Pilih bank', 'en-US': 'Select bank' },
  'Select digital wallet': { 'id-ID': 'Pilih dompet digital', 'en-US': 'Select digital wallet' },
  'QRIS payment will be recorded for this transaction.': {
    'id-ID': 'Pembayaran QRIS akan dicatat untuk transaksi ini.',
    'en-US': 'QRIS payment will be recorded for this transaction.',
  },
  'Amount paid': { 'id-ID': 'Uang dibayar', 'en-US': 'Amount paid' },
  'Payment short': { 'id-ID': 'Pembayaran kurang', 'en-US': 'Payment short' },
  Change: { 'id-ID': 'Kembalian', 'en-US': 'Change' },
  'Select a provider if required, then record the payment.': {
    'id-ID': 'Pilih penyedia bila diperlukan, lalu catat pembayaran.',
    'en-US': 'Select a provider if required, then record the payment.',
  },
  'Cancellation reason': { 'id-ID': 'Alasan pembatalan', 'en-US': 'Cancellation reason' },
  'Not ready to complete': { 'id-ID': 'Belum siap diselesaikan', 'en-US': 'Not ready to complete' },
  Work: { 'id-ID': 'Pengerjaan', 'en-US': 'Work' },
  Configure: { 'id-ID': 'Atur', 'en-US': 'Configure' },
  Cashier: { 'id-ID': 'Kasir', 'en-US': 'Cashier' },
  Discount: { 'id-ID': 'Diskon', 'en-US': 'Discount' },
  'Paid amount': { 'id-ID': 'Dibayar', 'en-US': 'Paid amount' },
  'Cash received': { 'id-ID': 'Uang diterima', 'en-US': 'Cash received' },
  'Thank you for your purchase.': {
    'id-ID': 'Terima kasih telah bertransaksi.',
    'en-US': 'Thank you for your purchase.',
  },
  'work units': { 'id-ID': 'pengerjaan', 'en-US': 'work units' },
  'Promotion discount': { 'id-ID': 'Promo dan diskon', 'en-US': 'Promotion discount' },
  Balance: { 'id-ID': 'Sisa', 'en-US': 'Balance' },
  'Changes apply to this transaction.': {
    'id-ID': 'Perubahan hanya berlaku pada transaksi ini.',
    'en-US': 'Changes apply to this transaction.',
  },
  'Confirm adjustment': { 'id-ID': 'Simpan penyesuaian', 'en-US': 'Confirm adjustment' },
  'Previous payment remains recorded': {
    'id-ID': 'Pembayaran sebelumnya tetap tercatat',
    'en-US': 'Previous payment remains recorded',
  },
  'You can add items. Reducing or removing paid items requires a refund.': {
    'id-ID':
      'Anda dapat menambah item. Pengurangan atau penghapusan item berbayar memerlukan pengembalian dana.',
    'en-US': 'You can add items. Reducing or removing paid items requires a refund.',
  },
  'Change quantity or remove items that have not started, then confirm.': {
    'id-ID': 'Ubah jumlah atau hapus item yang belum dimulai, lalu simpan penyesuaian.',
    'en-US': 'Change quantity or remove items that have not started, then confirm.',
  },
  'Add item from catalog': {
    'id-ID': 'Tambah item dari katalog',
    'en-US': 'Add item from catalog',
  },
  'Search product or service': {
    'id-ID': 'Cari produk atau layanan',
    'en-US': 'Search product or service',
  },
  'Search by item name or code.': {
    'id-ID': 'Cari berdasarkan nama atau kode item.',
    'en-US': 'Search by item name or code.',
  },
  Variant: { 'id-ID': 'Varian', 'en-US': 'Variant' },
  'Add item': { 'id-ID': 'Tambahkan item', 'en-US': 'Add item' },
  'Payment amount is insufficient.': {
    'id-ID': 'Jumlah pembayaran belum mencukupi.',
    'en-US': 'Payment amount is insufficient.',
  },
  'Record payment': { 'id-ID': 'Catat pembayaran', 'en-US': 'Record payment' },
  'Cancel this transaction?': {
    'id-ID': 'Batalkan transaksi ini?',
    'en-US': 'Cancel this transaction?',
  },
  'The transaction remains recorded in today queue.': {
    'id-ID': 'Transaksi tetap tercatat di antrian hari ini.',
    'en-US': "The transaction remains recorded in today's queue.",
  },
  'Example: Customer request': {
    'id-ID': 'Contoh: Permintaan pelanggan',
    'en-US': 'Example: Customer request',
  },
  Back: { 'id-ID': 'Kembali', 'en-US': 'Back' },
  'Confirm cancellation': { 'id-ID': 'Batalkan transaksi', 'en-US': 'Confirm cancellation' },
  'Employees for service': { 'id-ID': 'Karyawan untuk layanan', 'en-US': 'Employees for service' },
  'Set employees and contribution shares before completing the transaction.': {
    'id-ID': 'Atur karyawan dan porsi kontribusi sebelum menyelesaikan transaksi.',
    'en-US': 'Set employees and contribution shares before completing the transaction.',
  },
  'All shares total 100%': { 'id-ID': 'Total porsi sudah 100%', 'en-US': 'All shares total 100%' },
  'Complete employee shares': {
    'id-ID': 'Lengkapi porsi karyawan',
    'en-US': 'Complete employee shares',
  },
  Employee: { 'id-ID': 'Karyawan', 'en-US': 'Employee' },
  Share: { 'id-ID': 'Porsi', 'en-US': 'Share' },
  'Add employee': { 'id-ID': 'Tambah karyawan', 'en-US': 'Add employee' },
  'Complete employees and make sure total share is 100%.': {
    'id-ID': 'Lengkapi karyawan dan pastikan total porsi 100%.',
    'en-US': 'Complete employees and make sure total share is 100%.',
  },
  'Manage work': { 'id-ID': 'Kelola pengerjaan', 'en-US': 'Manage work' },
  'Each work unit totals 100%': {
    'id-ID': 'Setiap pengerjaan sudah 100%',
    'en-US': 'Each work unit totals 100%',
  },
  'Each work unit must total 100%': {
    'id-ID': 'Setiap pengerjaan harus berjumlah 100%',
    'en-US': 'Each work unit must total 100%',
  },
  'Save work': { 'id-ID': 'Simpan pengerjaan', 'en-US': 'Save work' },
  'Work mode': { 'id-ID': 'Mode pengerjaan', 'en-US': 'Work mode' },
  'Same for all': { 'id-ID': 'Sama untuk semua', 'en-US': 'Same for all' },
  'Set per work unit': { 'id-ID': 'Atur per pengerjaan', 'en-US': 'Set per work unit' },
  'Apply this configuration to all work units.': {
    'id-ID': 'Terapkan pengaturan ini ke semua pengerjaan.',
    'en-US': 'Apply this configuration to all work units.',
  },
  'Work unit': { 'id-ID': 'Pengerjaan', 'en-US': 'Work unit' },
};

export function operationalPosCopy(value: string, locale: OperationalLocale): string | undefined {
  return posCopy[value]?.[locale];
}
