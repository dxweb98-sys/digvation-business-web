import type { OperationalLocale } from './operational-localization';

type LocalizedCopy = Record<OperationalLocale, string>;

const posCopy: Record<string, LocalizedCopy> = {
  'Pay later': { 'id-ID': 'Bayar nanti', 'en-US': 'Pay later' },
  'Payment timing': { 'id-ID': 'Waktu & Cara Pembayaran', 'en-US': 'Payment timing' },
  'Pay and add to queue': {
    'id-ID': 'Bayar dan masukkan ke antrian',
    'en-US': 'Pay and add to queue',
  },
  'Choose variant': { 'id-ID': 'Pilih varian', 'en-US': 'Choose variant' },
  'hour-short': { 'id-ID': 'jam', 'en-US': 'hr' },
  'minute-short': { 'id-ID': 'mnt', 'en-US': 'min' },
  Role: { 'id-ID': 'Peran', 'en-US': 'Role' },
  'App version': { 'id-ID': 'Versi aplikasi', 'en-US': 'App version' },
  'Switch branch': { 'id-ID': 'Ganti cabang', 'en-US': 'Switch branch' },
  'Send reset link via WhatsApp': {
    'id-ID': 'Kirim tautan lewat WhatsApp',
    'en-US': 'Send reset link via WhatsApp',
  },
  'A link to set a new password will be sent to the WhatsApp number registered on your account.': {
    'id-ID':
      'Tautan untuk membuat kata sandi baru akan dikirim ke nomor WhatsApp yang terdaftar pada akun Anda.',
    'en-US':
      'A link to set a new password will be sent to the WhatsApp number registered on your account.',
  },
  'Link sent to your WhatsApp.': {
    'id-ID': 'Tautan sudah dikirim ke WhatsApp Anda.',
    'en-US': 'Link sent to your WhatsApp.',
  },
  'Password change is not available yet. Contact your administrator.': {
    'id-ID': 'Ubah kata sandi belum dapat digunakan. Hubungi administrator Anda.',
    'en-US': 'Password change is not available yet. Contact your administrator.',
  },
  'The request could not be sent. Try again.': {
    'id-ID': 'Permintaan belum berhasil dikirim. Coba lagi.',
    'en-US': 'The request could not be sent. Try again.',
  },
  'Payment history': { 'id-ID': 'Riwayat pembayaran', 'en-US': 'Payment history' },
  'Promo code was not found.': {
    'id-ID': 'Kode promo tidak ditemukan.',
    'en-US': 'Promo code was not found.',
  },
  'This promotion is currently disabled.': {
    'id-ID': 'Promo sedang nonaktif.',
    'en-US': 'This promotion is currently disabled.',
  },
  'This promotion has not started yet.': {
    'id-ID': 'Promo belum berlaku.',
    'en-US': 'This promotion has not started yet.',
  },
  'This promotion has ended.': {
    'id-ID': 'Promo sudah berakhir.',
    'en-US': 'This promotion has ended.',
  },
  'This promo code is not valid at this location.': {
    'id-ID': 'Kode promo tidak berlaku di cabang ini.',
    'en-US': 'This promo code is not valid at this location.',
  },
  'This promo code is not valid for the transaction currency.': {
    'id-ID': 'Kode promo tidak berlaku untuk mata uang transaksi ini.',
    'en-US': 'This promo code is not valid for the transaction currency.',
  },
  'The minimum purchase has not been met.': {
    'id-ID': 'Minimum pembelian belum terpenuhi.',
    'en-US': 'The minimum purchase has not been met.',
  },
  'This promo code does not apply to the items in this transaction.': {
    'id-ID': 'Kode promo tidak berlaku untuk item pada transaksi ini.',
    'en-US': 'This promo code does not apply to the items in this transaction.',
  },
  'No payment recorded yet.': {
    'id-ID': 'Belum ada pembayaran yang dicatat.',
    'en-US': 'No payment recorded yet.',
  },
  'Performed by': { 'id-ID': 'Dikerjakan oleh', 'en-US': 'Performed by' },
  'Order summary': { 'id-ID': 'Ringkasan', 'en-US': 'Summary' },
  'Whole transaction': { 'id-ID': 'Seluruh transaksi', 'en-US': 'Whole transaction' },
  'Item-level': { 'id-ID': 'Per item', 'en-US': 'Item-level' },
  'Category-level': { 'id-ID': 'Per kategori', 'en-US': 'Category-level' },
  'Balance due': { 'id-ID': 'Sisa tagihan', 'en-US': 'Balance due' },
  'Tax and promotions are finalized when the transaction is created.': {
    'id-ID': 'Pajak dan promo dihitung saat transaksi dibuat.',
    'en-US': 'Tax and promotions are finalized when the transaction is created.',
  },
  'Promotions & discounts': { 'id-ID': 'Promo & diskon', 'en-US': 'Promotions & discounts' },
  'No promotion or discount applied yet.': {
    'id-ID': 'Belum ada promo atau diskon.',
    'en-US': 'No promotion or discount applied yet.',
  },
  'Manage adjustments': { 'id-ID': 'Atur', 'en-US': 'Manage' },
  'Add adjustment': { 'id-ID': 'Tambah', 'en-US': 'Add' },
  'Add promotion': { 'id-ID': 'Tambah Promo', 'en-US': 'Add promotion' },
  'Applied adjustments': { 'id-ID': 'Sedang diterapkan', 'en-US': 'Currently applied' },
  'Total after adjustments': {
    'id-ID': 'Total setelah penyesuaian',
    'en-US': 'Total after adjustments',
  },
  'Manual discount': { 'id-ID': 'Diskon manual', 'en-US': 'Manual discount' },
  'Opening Operational…': { 'id-ID': 'Membuka Operational…', 'en-US': 'Opening Operational…' },
  'Preparing Operational': { 'id-ID': 'Menyiapkan Operational', 'en-US': 'Preparing Operational' },
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
  'Employee unavailable': {
    'id-ID': 'Karyawan tidak tersedia',
    'en-US': 'Employee unavailable',
  },
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
  'Order details': { 'id-ID': 'Detail pesanan', 'en-US': 'Order details' },
  'Review the items before payment.': {
    'id-ID': 'Periksa kembali item sebelum pembayaran.',
    'en-US': 'Review the items before payment.',
  },
  'POS payment': { 'id-ID': 'Pembayaran POS', 'en-US': 'POS Payment' },
  'Transaction ID': { 'id-ID': 'ID Transaksi', 'en-US': 'Transaction ID' },
  Points: { 'id-ID': 'Poin', 'en-US': 'Points' },
  'Net total': { 'id-ID': 'Total Bersih', 'en-US': 'Net total' },
  'Ready to pay': { 'id-ID': 'Siap bayar', 'en-US': 'Ready to pay' },
  'Payment total': { 'id-ID': 'Total pembayaran', 'en-US': 'Payment total' },
  'Transaction discount': { 'id-ID': 'Diskon transaksi', 'en-US': 'Transaction discount' },
  'Promotions and discounts': { 'id-ID': 'Promo dan diskon', 'en-US': 'Promotions and discounts' },
  Promotion: { 'id-ID': 'Promo', 'en-US': 'Promotion' },
  'Use member points': { 'id-ID': 'Gunakan poin member', 'en-US': 'Use member points' },
  'Loyalty points': { 'id-ID': 'Poin loyalty', 'en-US': 'Loyalty points' },
  'Point balance': { 'id-ID': 'Saldo poin', 'en-US': 'Point balance' },
  'Loyalty redemption': { 'id-ID': 'Penggunaan poin', 'en-US': 'Loyalty redemption' },
  'points used': { 'id-ID': 'poin digunakan', 'en-US': 'points used' },
  'Use loyalty points': { 'id-ID': 'Gunakan poin', 'en-US': 'Use loyalty points' },
  'Change points': { 'id-ID': 'Ubah poin', 'en-US': 'Change points' },
  'Points to use': { 'id-ID': 'Jumlah Poin Ditukarkan', 'en-US': 'Points to use' },
  'Available balance': { 'id-ID': 'Saldo tersedia', 'en-US': 'Available balance' },
  points: { 'id-ID': 'poin', 'en-US': 'points' },
  'Enter the number of points to use for this transaction.': {
    'id-ID': 'Masukkan jumlah poin yang ingin digunakan untuk transaksi ini.',
    'en-US': 'Enter the number of points to use for this transaction.',
  },
  'Points are only consumed after the transaction is finalized.': {
    'id-ID': 'Poin baru dipotong setelah transaksi berhasil diselesaikan.',
    'en-US': 'Points are only consumed after the transaction is finalized.',
  },
  Update: { 'id-ID': 'Perbarui', 'en-US': 'Update' },
  'Use member points for this transaction. Points are consumed only when the sale is finalized.': {
    'id-ID': 'Gunakan poin member untuk transaksi ini. Poin baru dipotong saat transaksi berhasil diselesaikan.',
    'en-US': 'Use member points for this transaction. Points are consumed only when the sale is finalized.',
  },
  'Loading loyalty points…': { 'id-ID': 'Memuat poin loyalty…', 'en-US': 'Loading loyalty points…' },
  'Use all': { 'id-ID': 'Pakai semua', 'en-US': 'Use all' },
  'Fill all': { 'id-ID': 'Isi semua', 'en-US': 'Fill all' },
  'Insufficient loyalty points': {
    'id-ID': 'Poin tidak mencukupi',
    'en-US': 'Insufficient loyalty points',
  },
  'The requested points exceed the member point balance.': {
    'id-ID': 'Jumlah poin yang digunakan melebihi saldo poin member.',
    'en-US': 'The requested points exceed the member point balance.',
  },
  'Could not apply loyalty points': {
    'id-ID': 'Poin loyalty tidak dapat digunakan',
    'en-US': 'Could not apply loyalty points',
  },
  'Calculating…': { 'id-ID': 'Menghitung…', 'en-US': 'Calculating…' },
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
  'Item discount': { 'id-ID': 'Diskon item', 'en-US': 'Item discount' },
  'Tax included': { 'id-ID': 'Pajak termasuk', 'en-US': 'Tax included' },
  'Paid amount': { 'id-ID': 'Dibayar', 'en-US': 'Paid amount' },
  'Cash received': { 'id-ID': 'Uang diterima', 'en-US': 'Cash received' },
  'Exact amount': { 'id-ID': 'Pas', 'en-US': 'Exact' },
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
  'Every work unit needs at least one employee.': {
    'id-ID': 'Setiap pengerjaan membutuhkan minimal satu karyawan.',
    'en-US': 'Every work unit needs at least one employee.',
  },
  'Work units are not available for this transaction.': {
    'id-ID': 'Pengerjaan belum tersedia untuk transaksi ini.',
    'en-US': 'Work units are not available for this transaction.',
  },
  Refund: { 'id-ID': 'Pengembalian dana', 'en-US': 'Refund' },
  'Additional payment': { 'id-ID': 'Tambahan pembayaran', 'en-US': 'Additional payment' },
  'Save adjustment': { 'id-ID': 'Simpan penyesuaian', 'en-US': 'Save adjustment' },
  'Each change is recorded right away.': {
    'id-ID': 'Setiap perubahan langsung tercatat.',
    'en-US': 'Each change is recorded right away.',
  },
  'Each change is recorded right away. Items already paid stay on the payment record.': {
    'id-ID':
      'Setiap perubahan langsung tercatat. Item yang sudah dibayar tetap ada di catatan pembayaran.',
    'en-US': 'Each change is recorded right away. Items already paid stay on the payment record.',
  },
  New: { 'id-ID': 'Baru', 'en-US': 'New' },
  Was: { 'id-ID': 'Semula', 'en-US': 'Was' },
  'items removed': { 'id-ID': 'item dihapus', 'en-US': 'items removed' },
  'Who is doing this service?': {
    'id-ID': 'Siapa yang mengerjakan?',
    'en-US': 'Who is doing this service?',
  },
  'How employees are assigned': {
    'id-ID': 'Cara menentukan karyawan',
    'en-US': 'How employees are assigned',
  },
  'Same for every service': { 'id-ID': 'Sama untuk semua', 'en-US': 'Same for every service' },
  'Different for each service': {
    'id-ID': 'Berbeda tiap layanan',
    'en-US': 'Different for each service',
  },
  'Service being set': { 'id-ID': 'Layanan yang sedang diatur', 'en-US': 'Service being set' },
  'services set': { 'id-ID': 'layanan sudah diatur', 'en-US': 'services set' },
  'Previous service': { 'id-ID': 'Layanan sebelumnya', 'en-US': 'Previous service' },
  'Next service': { 'id-ID': 'Layanan berikutnya', 'en-US': 'Next service' },
  Set: { 'id-ID': 'Sudah diatur', 'en-US': 'Set' },
  'Check the percentages': { 'id-ID': 'Periksa persentase', 'en-US': 'Check the percentages' },
  'Employees for this service': {
    'id-ID': 'Karyawan untuk layanan ini',
    'en-US': 'Employees for this service',
  },
  employees: { 'id-ID': 'karyawan', 'en-US': 'employees' },
  'Work split': { 'id-ID': 'Pembagian pengerjaan', 'en-US': 'Work split' },
  'Change one percentage; the rest is shared automatically.': {
    'id-ID': 'Ubah persentase satu karyawan, sisanya dibagi otomatis.',
    'en-US': 'Change one percentage; the rest is shared automatically.',
  },
  auto: { 'id-ID': 'otomatis', 'en-US': 'auto' },
  'Percentages exceed 100%. Lower one of them.': {
    'id-ID': 'Total persentase melebihi 100%. Kurangi salah satunya.',
    'en-US': 'Percentages exceed 100%. Lower one of them.',
  },
  'Percentages must total 100%.': {
    'id-ID': 'Total persentase harus 100%.',
    'en-US': 'Percentages must total 100%.',
  },
  'Each service has its own setting. Replace them all with the setting of': {
    'id-ID': 'Tiap layanan punya pengaturan sendiri. Ganti semuanya dengan pengaturan',
    'en-US': 'Each service has its own setting. Replace them all with the setting of',
  },
  Replace: { 'id-ID': 'Ganti', 'en-US': 'Replace' },
  'The service line is no longer available.': {
    'id-ID': 'Layanan ini sudah tidak tersedia.',
    'en-US': 'The service line is no longer available.',
  },
  'Use for all services': { 'id-ID': 'Pakai untuk semua layanan', 'en-US': 'Use for all services' },
  'Applies to': { 'id-ID': 'Berlaku untuk', 'en-US': 'Applies to' },
  services: { 'id-ID': 'layanan', 'en-US': 'services' },
  Employees: { 'id-ID': 'Karyawan', 'en-US': 'Employees' },
  'employees selected': { 'id-ID': 'dipilih', 'en-US': 'employees selected' },
  'Search employee': { 'id-ID': 'Cari karyawan', 'en-US': 'Search employee' },
  'No employee matches this search.': {
    'id-ID': 'Tidak ada karyawan yang cocok.',
    'en-US': 'No employee matches this search.',
  },
  'Discard employee changes?': {
    'id-ID': 'Buang perubahan karyawan?',
    'en-US': 'Discard employee changes?',
  },
  'The employees and work split you changed will not be saved.': {
    'id-ID': 'Karyawan dan pembagian pengerjaan yang Anda ubah tidak akan disimpan.',
    'en-US': 'The employees and work split you changed will not be saved.',
  },
  Show: { 'id-ID': 'Tampilkan', 'en-US': 'Show' },
  more: { 'id-ID': 'lainnya', 'en-US': 'more' },
  'Show less': { 'id-ID': 'Sembunyikan', 'en-US': 'Show less' },
  'Discard changes': { 'id-ID': 'Buang perubahan', 'en-US': 'Discard changes' },
  'Keep editing': { 'id-ID': 'Lanjut mengubah', 'en-US': 'Keep editing' },
  'Select at least one employee.': {
    'id-ID': 'Pilih minimal satu karyawan.',
    'en-US': 'Select at least one employee.',
  },
  'No employee yet': { 'id-ID': 'Belum ada karyawan', 'en-US': 'No employee yet' },
  'no employee yet': { 'id-ID': 'belum ada karyawan', 'en-US': 'no employee yet' },
  'Choose employee': { 'id-ID': 'Pilih karyawan', 'en-US': 'Choose employee' },
  'Edit employee': { 'id-ID': 'Ubah', 'en-US': 'Edit employee' },
  'Change employee': { 'id-ID': 'Ubah karyawan', 'en-US': 'Change employee' },
  'Paper width': { 'id-ID': 'Lebar kertas', 'en-US': 'Paper width' },
  'Send receipt': { 'id-ID': 'Kirim struk', 'en-US': 'Send receipt' },
  'Send receipt to customer': {
    'id-ID': 'Kirim struk ke customer',
    'en-US': 'Send receipt to customer',
  },
  'Receipt is being sent to the customer': {
    'id-ID': 'Struk sedang dikirim ke customer',
    'en-US': 'Receipt is being sent to the customer',
  },
  Remaining: { 'id-ID': 'Sisa', 'en-US': 'Remaining' },
  Received: { 'id-ID': 'Diterima', 'en-US': 'Received' },
  'Payment progress': { 'id-ID': 'Progres pembayaran', 'en-US': 'Payment progress' },
  'Already paid': { 'id-ID': 'Sudah dibayar', 'en-US': 'Already paid' },
  waiting: { 'id-ID': 'menunggu', 'en-US': 'waiting' },
  'will remain to pay with another method.': {
    'id-ID': 'tersisa untuk dibayar dengan metode lain.',
    'en-US': 'will remain to pay with another method.',
  },
  'Pay remaining': { 'id-ID': 'Bayar sisanya', 'en-US': 'Pay remaining' },
  'Pay full amount': { 'id-ID': 'Bayar penuh', 'en-US': 'Pay full amount' },
  'Pays the remaining balance': {
    'id-ID': 'Melunasi sisa tagihan',
    'en-US': 'Pays the remaining balance',
  },
  'Full payment': { 'id-ID': 'Bayar penuh', 'en-US': 'Full payment' },
  'Split payment': { 'id-ID': 'Split pembayaran', 'en-US': 'Split payment' },
  'Payment allocation': { 'id-ID': 'Cara pembayaran', 'en-US': 'Payment allocation' },
  'Pay full remaining balance': {
    'id-ID': 'Bayar seluruh sisa tagihan',
    'en-US': 'Pay the full remaining balance',
  },
  'No payment amount needs to be entered.': {
    'id-ID': 'Nominal otomatis mengikuti sisa tagihan, jadi tidak perlu diisi.',
    'en-US': 'The amount follows the remaining balance automatically, so no amount needs to be entered.',
  },
  'This payment completes the transaction.': {
    'id-ID': 'Pembayaran ini menyelesaikan transaksi.',
    'en-US': 'This payment completes the transaction.',
  },
  'You are receiving': { 'id-ID': 'Anda menerima pembayaran', 'en-US': 'You are receiving' },
  'You are receiving part of the total': {
    'id-ID': 'Anda menerima sebagian dari total',
    'en-US': 'You are receiving part of the total',
  },
  'Transaction total': { 'id-ID': 'Total transaksi', 'en-US': 'Transaction total' },
  'This payment': { 'id-ID': 'Pembayaran ini', 'en-US': 'This payment' },
  'Remaining after this payment': {
    'id-ID': 'Sisa setelah pembayaran ini',
    'en-US': 'Remaining after this payment',
  },
  'will remain. You will continue with another payment method.': {
    'id-ID': 'masih tersisa. Lanjutkan dengan metode pembayaran lain.',
    'en-US': 'will remain. You will continue with another payment method.',
  },
  'Check the method and amount. A recorded payment cannot be edited afterwards.': {
    'id-ID': 'Periksa metode dan nominal. Pembayaran yang sudah dicatat tidak dapat diubah.',
    'en-US': 'Check the method and amount. A recorded payment cannot be edited afterwards.',
  },
  'Waiting for payment': { 'id-ID': 'Menunggu pembayaran', 'en-US': 'Waiting for payment' },
  'Failed · not counted': { 'id-ID': 'Gagal · tidak dihitung', 'en-US': 'Failed · not counted' },
  'Cancelled · not counted': {
    'id-ID': 'Dibatalkan · tidak dihitung',
    'en-US': 'Cancelled · not counted',
  },
  'Expired · not counted': {
    'id-ID': 'Kedaluwarsa · tidak dihitung',
    'en-US': 'Expired · not counted',
  },
  'Payments recorded': { 'id-ID': 'Pembayaran tercatat', 'en-US': 'Payments recorded' },
  'Check that this payment was received before confirming it.': {
    'id-ID': 'Pastikan pembayaran ini sudah diterima sebelum dikonfirmasi.',
    'en-US': 'Check that this payment was received before confirming it.',
  },
  'Received · complete payment': {
    'id-ID': 'Diterima · selesaikan pembayaran',
    'en-US': 'Received · complete payment',
  },
  'Payment received': { 'id-ID': 'Pembayaran diterima', 'en-US': 'Payment received' },
  'Not received': { 'id-ID': 'Tidak diterima', 'en-US': 'Not received' },
  'Cancel this payment': { 'id-ID': 'Batalkan pembayaran ini', 'en-US': 'Cancel this payment' },
  'Payment is not finished': {
    'id-ID': 'Pembayaran belum selesai',
    'en-US': 'Payment is not finished',
  },
  'is already recorded for this transaction.': {
    'id-ID': 'sudah tercatat untuk transaksi ini.',
    'en-US': 'is already recorded for this transaction.',
  },
  'is still unpaid.': { 'id-ID': 'belum dibayar.', 'en-US': 'is still unpaid.' },
  'A payment is waiting for confirmation. Confirm or cancel it before leaving the payment.': {
    'id-ID':
      'Ada pembayaran yang menunggu konfirmasi. Konfirmasi atau batalkan sebelum meninggalkan pembayaran.',
    'en-US':
      'A payment is waiting for confirmation. Confirm or cancel it before leaving the payment.',
  },
  'Continue with another payment method, or add the transaction to the queue and collect the rest later. Recorded payments stay on the transaction.':
    {
      'id-ID':
        'Lanjutkan dengan metode pembayaran lain, atau masukkan transaksi ke antrian dan tagih sisanya nanti. Pembayaran yang sudah tercatat tetap tersimpan di transaksi.',
      'en-US':
        'Continue with another payment method, or add the transaction to the queue and collect the rest later. Recorded payments stay on the transaction.',
    },
  'Confirm payment': { 'id-ID': 'Konfirmasi pembayaran', 'en-US': 'Confirm payment' },
  'Continue payment': { 'id-ID': 'Lanjutkan pembayaran', 'en-US': 'Continue payment' },
  'Back to edit': { 'id-ID': 'Kembali ubah', 'en-US': 'Back to edit' },
  'Confirm and complete': { 'id-ID': 'Konfirmasi dan selesaikan', 'en-US': 'Confirm and complete' },
  'Add to queue, collect later': {
    'id-ID': 'Masukkan antrian, tagih nanti',
    'en-US': 'Add to queue, collect later',
  },
  'Leave payment': { 'id-ID': 'Tinggalkan pembayaran', 'en-US': 'Leave payment' },
  'The transaction is not complete until the remaining amount is paid.': {
    'id-ID': 'Transaksi belum selesai sampai sisa tagihan dibayar.',
    'en-US': 'The transaction is not complete until the remaining amount is paid.',
  },
  'Next payment': { 'id-ID': 'Pembayaran berikutnya', 'en-US': 'Next payment' },
  'Payment was not recorded': {
    'id-ID': 'Pembayaran tidak tercatat',
    'en-US': 'Payment was not recorded',
  },
  'Nothing was added to the paid amount.': {
    'id-ID': 'Tidak ada yang ditambahkan ke jumlah terbayar.',
    'en-US': 'Nothing was added to the paid amount.',
  },
  'Confirm or cancel the waiting payment before adding another one.': {
    'id-ID': 'Konfirmasi atau batalkan pembayaran yang menunggu sebelum menambah pembayaran lain.',
    'en-US': 'Confirm or cancel the waiting payment before adding another one.',
  },
  'Payment waiting for confirmation': {
    'id-ID': 'Pembayaran menunggu konfirmasi',
    'en-US': 'Payment waiting for confirmation',
  },
  'Confirm the payment once it is received.': {
    'id-ID': 'Konfirmasi pembayaran setelah dana diterima.',
    'en-US': 'Confirm the payment once it is received.',
  },
  'Added to queue. Collect the remaining balance from the queue.': {
    'id-ID': 'Masuk antrian. Tagih sisa pembayaran dari antrian.',
    'en-US': 'Added to queue. Collect the remaining balance from the queue.',
  },
  'Payment updated': { 'id-ID': 'Pembayaran diperbarui', 'en-US': 'Payment updated' },
  'Transaction payment is complete.': {
    'id-ID': 'Pembayaran transaksi sudah lunas.',
    'en-US': 'Transaction payment is complete.',
  },
  'Resolve pending payments before continuing.': {
    'id-ID': 'Selesaikan pembayaran yang menunggu sebelum melanjutkan.',
    'en-US': 'Resolve pending payments before continuing.',
  },
  'Check the money has arrived': {
    'id-ID': 'Pastikan dana sudah masuk',
    'en-US': 'Check the money has arrived',
  },
  'Confirm only after the payment is visible in': {
    'id-ID': 'Konfirmasi hanya setelah pembayaran terlihat di',
    'en-US': 'Confirm only after the payment is visible in',
  },
  'It is recorded as received immediately.': {
    'id-ID': 'Pembayaran langsung dicatat sebagai diterima.',
    'en-US': 'It is recorded as received immediately.',
  },
  'Received payments cannot be edited or removed here. If one is wrong, do not record it again; tell your manager so it can be corrected.':
    {
      'id-ID':
        'Pembayaran yang sudah diterima tidak dapat diubah atau dihapus di sini. Jika ada yang salah, jangan catat ulang; laporkan ke manajer agar dikoreksi.',
      'en-US':
        'Received payments cannot be edited or removed here. If one is wrong, do not record it again; tell your manager so it can be corrected.',
    },
  'Split Payment': { 'id-ID': 'Split Payment', 'en-US': 'Split Payment' },
  methods: { 'id-ID': 'metode', 'en-US': 'methods' },
  'Total paid': { 'id-ID': 'Total dibayar', 'en-US': 'Total paid' },
  'Other payment attempts': {
    'id-ID': 'Percobaan pembayaran lain',
    'en-US': 'Other payment attempts',
  },
};

export function operationalPosCopy(value: string, locale: OperationalLocale): string | undefined {
  return posCopy[value]?.[locale];
}
