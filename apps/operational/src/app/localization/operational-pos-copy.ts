import type { OperationalLocale } from './operational-localization';

type LocalizedCopy = Record<OperationalLocale, string>;

const posCopy: Record<string, LocalizedCopy> = {
  'Operational is not enabled for this business': {
    'id-ID': 'Operasional belum diaktifkan untuk bisnis ini',
    'en-US': 'Operational is not enabled for this business',
  },
  'No Operational module is available for your account': {
    'id-ID': 'Belum ada modul Operasional untuk akun Anda',
    'en-US': 'No Operational module is available for your account',
  },
  'The modules used in Operational have not been enabled for this business. Contact your business administrator.':
    {
      'id-ID':
        'Modul yang dipakai di Operasional belum diaktifkan untuk bisnis ini. Hubungi administrator bisnis Anda.',
      'en-US':
        'The modules used in Operational have not been enabled for this business. Contact your business administrator.',
    },
  'Your role does not include Sell, Customers or Expenses. Ask your business administrator to update your role in Backoffice, then check again.':
    {
      'id-ID':
        'Peran Anda belum mencakup Jual, Pelanggan, atau Pengeluaran. Minta administrator bisnis memperbarui peran Anda di Backoffice, lalu periksa lagi.',
      'en-US':
        'Your role does not include Sell, Customers or Expenses. Ask your business administrator to update your role in Backoffice, then check again.',
    },
  'Your access has not changed yet.': {
    'id-ID': 'Akses Anda belum berubah.',
    'en-US': 'Your access has not changed yet.',
  },
  'Access could not be checked. Try again.': {
    'id-ID': 'Akses belum dapat diperiksa. Coba lagi.',
    'en-US': 'Access could not be checked. Try again.',
  },
  'Use another account': { 'id-ID': 'Gunakan akun lain', 'en-US': 'Use another account' },
  'Check again': { 'id-ID': 'Periksa lagi', 'en-US': 'Check again' },
  'Go to Sell': { 'id-ID': 'Buka Jual', 'en-US': 'Go to Sell' },
  'Go to Expenses': { 'id-ID': 'Buka Pengeluaran', 'en-US': 'Go to Expenses' },
  'Go to Customers': { 'id-ID': 'Buka Pelanggan', 'en-US': 'Go to Customers' },
  'Operational access could not be loaded': {
    'id-ID': 'Akses operasional belum dapat dimuat',
    'en-US': 'Operational access could not be loaded',
  },
  'Check your connection and try again.': {
    'id-ID': 'Periksa koneksi Anda lalu coba lagi.',
    'en-US': 'Check your connection and try again.',
  },
  'Try again': { 'id-ID': 'Coba lagi', 'en-US': 'Try again' },
  'Ask your business administrator to grant location access in Backoffice, then sign in again.': {
    'id-ID': 'Minta administrator bisnis memberi akses lokasi di Backoffice, lalu masuk lagi.',
    'en-US':
      'Ask your business administrator to grant location access in Backoffice, then sign in again.',
  },
  Password: { 'id-ID': 'Kata sandi', 'en-US': 'Password' },
  'Change password': { 'id-ID': 'Ubah kata sandi', 'en-US': 'Change password' },
  'Change with your current password': {
    'id-ID': 'Ubah dengan kata sandi saat ini',
    'en-US': 'Change with your current password',
  },
  'Current password': { 'id-ID': 'Kata sandi saat ini', 'en-US': 'Current password' },
  'New password': { 'id-ID': 'Kata sandi baru', 'en-US': 'New password' },
  'Confirm new password': {
    'id-ID': 'Konfirmasi kata sandi baru',
    'en-US': 'Confirm new password',
  },
  'At least 10 characters.': {
    'id-ID': 'Minimal 10 karakter.',
    'en-US': 'At least 10 characters.',
  },
  'Password must contain 10 to 128 characters.': {
    'id-ID': 'Kata sandi harus terdiri dari 10 sampai 128 karakter.',
    'en-US': 'Password must contain 10 to 128 characters.',
  },
  'Password confirmation does not match.': {
    'id-ID': 'Konfirmasi kata sandi belum sama.',
    'en-US': 'Password confirmation does not match.',
  },
  'The new password must differ from the current password.': {
    'id-ID': 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    'en-US': 'The new password must differ from the current password.',
  },
  'The current password is incorrect.': {
    'id-ID': 'Kata sandi saat ini tidak benar.',
    'en-US': 'The current password is incorrect.',
  },
  'Your session has ended. Sign in again, then try once more.': {
    'id-ID': 'Sesi Anda sudah berakhir. Masuk lagi, lalu coba kembali.',
    'en-US': 'Your session has ended. Sign in again, then try once more.',
  },
  'Too many attempts. Try again shortly.': {
    'id-ID': 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.',
    'en-US': 'Too many attempts. Try again shortly.',
  },
  'The password could not be changed. Try again shortly.': {
    'id-ID': 'Kata sandi belum dapat diubah. Coba lagi beberapa saat lagi.',
    'en-US': 'The password could not be changed. Try again shortly.',
  },
  'Password changed. All sessions have ended; sign in again with the new password.': {
    'id-ID':
      'Kata sandi berhasil diubah. Semua sesi telah berakhir; masuk lagi dengan kata sandi baru.',
    'en-US': 'Password changed. All sessions have ended; sign in again with the new password.',
  },
  'Sign in again': { 'id-ID': 'Masuk lagi', 'en-US': 'Sign in again' },
  'Enter your current password and a new one. After it succeeds, all your sessions end and you sign in again.':
    {
      'id-ID':
        'Masukkan kata sandi saat ini dan kata sandi baru. Setelah berhasil, semua sesi Anda berakhir dan Anda perlu masuk lagi.',
      'en-US':
        'Enter your current password and a new one. After it succeeds, all your sessions end and you sign in again.',
    },
  'Forgot your current password?': {
    'id-ID': 'Lupa kata sandi saat ini?',
    'en-US': 'Forgot your current password?',
  },
  'Link submitted to WhatsApp.': {
    'id-ID':
      'Tautan telah diserahkan ke penyedia WhatsApp. Jika belum masuk, coba lagi sebentar lagi.',
    'en-US':
      'The link was handed to WhatsApp for delivery. If it does not arrive, try again shortly.',
  },
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
  'A link was sent a moment ago. Check WhatsApp or try again shortly.': {
    'id-ID': 'Tautan baru saja dikirim. Periksa WhatsApp atau coba lagi sebentar lagi.',
    'en-US': 'A link was sent a moment ago. Check WhatsApp or try again shortly.',
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
  'This promotion is for active members only.': {
    'id-ID': 'Promo ini khusus untuk member aktif.',
    'en-US': 'This promotion is for active members only.',
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
  'The service was not started. Try again.': {
    'id-ID': 'Layanan belum dimulai. Coba lagi.',
    'en-US': 'The service was not started. Try again.',
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
  'Point preview': { 'id-ID': 'Perkiraan poin', 'en-US': 'Point preview' },
  'Points earned': { 'id-ID': 'Poin diperoleh', 'en-US': 'Points earned' },
  'Receipt point balance': { 'id-ID': 'Saldo', 'en-US': 'Balance' },
  'Points gained': { 'id-ID': 'Diperoleh', 'en-US': 'Earned' },
  'Net total': { 'id-ID': 'Total Bersih', 'en-US': 'Net total' },
  'Ready to pay': { 'id-ID': 'Siap bayar', 'en-US': 'Ready to pay' },
  'Payment total': { 'id-ID': 'Total pembayaran', 'en-US': 'Payment total' },
  'Show details': { 'id-ID': 'Lihat rincian', 'en-US': 'Show details' },
  'Hide details': { 'id-ID': 'Sembunyikan rincian', 'en-US': 'Hide details' },
  'Transaction discount': { 'id-ID': 'Diskon transaksi', 'en-US': 'Transaction discount' },
  'Promotions and discounts': { 'id-ID': 'Promo dan diskon', 'en-US': 'Promotions and discounts' },
  Promotion: { 'id-ID': 'Promo', 'en-US': 'Promotion' },
  'Use member points': { 'id-ID': 'Gunakan poin member', 'en-US': 'Use member points' },
  'Loyalty points': { 'id-ID': 'Poin loyalty', 'en-US': 'Loyalty points' },
  'Point balance': { 'id-ID': 'Saldo poin', 'en-US': 'Point balance' },
  'Current points': { 'id-ID': 'Poin saat ini', 'en-US': 'Current points' },
  Earned: { 'id-ID': 'Didapat', 'en-US': 'Earned' },
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
    'id-ID':
      'Gunakan poin member untuk transaksi ini. Poin baru dipotong saat transaksi berhasil diselesaikan.',
    'en-US':
      'Use member points for this transaction. Points are consumed only when the sale is finalized.',
  },
  'Loading loyalty points…': {
    'id-ID': 'Memuat poin loyalty…',
    'en-US': 'Loading loyalty points…',
  },
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
  'Cash received': { 'id-ID': 'Uang tunai diterima', 'en-US': 'Physical cash received' },
  'Discounts and promotions': { 'id-ID': 'Diskon dan Promo', 'en-US': 'Discounts and promotions' },
  'Discount details': { 'id-ID': 'Rincian diskon dan promo', 'en-US': 'Discount details' },
  'Return to order': { 'id-ID': 'Ubah pesanan', 'en-US': 'Edit order' },
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
  'Start a new transaction? This transaction stays in the queue as awaiting settlement.': {
    'id-ID': 'Mulai transaksi baru? Transaksi ini tetap ada di Antrian sebagai Menunggu pelunasan.',
    'en-US': 'Start a new transaction? This transaction stays in the queue as awaiting settlement.',
  },
  'Continue that payment? The current transaction will remain open.': {
    'id-ID': 'Lanjutkan pembayaran tersebut? Transaksi saat ini tetap terbuka.',
    'en-US': 'Continue that payment? The current transaction will remain open.',
  },
  'Continue that payment? The items in the current cart are removed.': {
    'id-ID': 'Lanjutkan pembayaran tersebut? Item di keranjang saat ini akan dihapus.',
    'en-US': 'Continue that payment? The items in the current cart are removed.',
  },
  'Continue later': { 'id-ID': 'Lanjutkan nanti', 'en-US': 'Continue later' },
  'Continue later keeps this transaction in the queue as awaiting settlement. Recorded payments stay on the transaction, and you can serve another customer.':
    {
      'id-ID':
        'Lanjutkan nanti menyimpan transaksi ini di Antrian sebagai Menunggu pelunasan. Pembayaran yang sudah tercatat tetap tersimpan, dan Anda bisa melayani pelanggan lain.',
      'en-US':
        'Continue later keeps this transaction in the queue as awaiting settlement. Recorded payments stay on the transaction, and you can serve another customer.',
    },
  'A payment waiting for confirmation stays on the transaction. Confirm it when you continue the payment.':
    {
      'id-ID':
        'Pembayaran yang menunggu konfirmasi tetap tersimpan di transaksi. Konfirmasi saat Anda melanjutkan pembayaran.',
      'en-US':
        'A payment waiting for confirmation stays on the transaction. Confirm it when you continue the payment.',
    },
  'Payment continues later': {
    'id-ID': 'Pembayaran dilanjutkan nanti',
    'en-US': 'Payment continues later',
  },
  'is in the queue as awaiting settlement.': {
    'id-ID': 'ada di Antrian sebagai Menunggu pelunasan.',
    'en-US': 'is in the queue as awaiting settlement.',
  },
  'This transaction has work to complete before it can be finished.': {
    'id-ID': 'Transaksi ini memiliki pengerjaan yang harus diselesaikan terlebih dahulu.',
    'en-US': 'This transaction has work to complete before it can be finished.',
  },
  'Payment is preserved. Try completing the transaction again.': {
    'id-ID': 'Pembayaran tersimpan. Coba selesaikan transaksi lagi.',
    'en-US': 'Payment is preserved. Try completing the transaction again.',
  },
  'Search product or service': {
    'id-ID': 'Cari produk atau layanan',
    'en-US': 'Search product or service',
  },
  'Add to order': { 'id-ID': 'Tambahkan ke pesanan', 'en-US': 'Add to order' },
  'Loading item…': { 'id-ID': 'Memuat item…', 'en-US': 'Loading item…' },
  'The item could not be loaded. Choose it again.': {
    'id-ID': 'Item belum dapat dimuat. Pilih item lagi.',
    'en-US': 'The item could not be loaded. Choose it again.',
  },
  'The item could not be added. Reload the transaction and try again.': {
    'id-ID': 'Item belum dapat ditambahkan. Muat ulang transaksi lalu coba lagi.',
    'en-US': 'The item could not be added. Reload the transaction and try again.',
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
  'Adjustment saved': { 'id-ID': 'Penyesuaian berhasil disimpan', 'en-US': 'Adjustment saved' },
  'Payment correction': { 'id-ID': 'Koreksi pembayaran', 'en-US': 'Payment correction' },
  'Payment correction explanation': {
    'id-ID': 'Perbaiki pencatatan pembayaran tanpa mengubah total yang dibayar pelanggan.',
    'en-US': 'Correct how the payment was recorded without changing the total the customer paid.',
  },
  'Recorded now': { 'id-ID': 'Pencatatan saat ini', 'en-US': 'Currently recorded' },
  'Correct recording': { 'id-ID': 'Pencatatan yang benar', 'en-US': 'Correct recording' },
  'Correction changes': { 'id-ID': 'Perubahan', 'en-US': 'Changes' },
  'Correction reason placeholder': {
    'id-ID': 'Contoh: Salah memasukkan nominal pembayaran',
    'en-US': 'For example: the payment amount was entered wrongly',
  },
  'Save correction': { 'id-ID': 'Simpan koreksi', 'en-US': 'Save correction' },
  'Effective payment': { 'id-ID': 'Pembayaran efektif', 'en-US': 'Effective payment' },
  'Corrected by': { 'id-ID': 'Dikoreksi oleh', 'en-US': 'Corrected by' },
  'Correction after reconciliation': {
    'id-ID': 'Koreksi setelah rekonsiliasi',
    'en-US': 'Correction after reconciliation',
  },
  'Correction reduced': { 'id-ID': 'Dikurangi', 'en-US': 'Reduced' },
  'Correction added': { 'id-ID': 'Ditambah', 'en-US': 'Added' },
  'The total paid must stay the same.': {
    'id-ID': 'Total dibayar harus tetap sama.',
    'en-US': 'The total paid must stay the same.',
  },
  'Correction difference': { 'id-ID': 'Selisih', 'en-US': 'Difference' },
  'Payment correction saved': {
    'id-ID': 'Koreksi pembayaran disimpan',
    'en-US': 'Payment correction saved',
  },
  'The payment correction could not be saved. Try again.': {
    'id-ID': 'Koreksi pembayaran tidak dapat disimpan. Coba lagi.',
    'en-US': 'The payment correction could not be saved. Try again.',
  },
  'Payment correction is not available.': {
    'id-ID': 'Koreksi pembayaran belum tersedia.',
    'en-US': 'Payment correction is not available.',
  },
  'Reload latest transaction': {
    'id-ID': 'Muat ulang transaksi',
    'en-US': 'Reload latest transaction',
  },
  'A route cannot give away more than was recorded on it.': {
    'id-ID': 'Satu jalur pembayaran tidak dapat dikurangi melebihi yang tercatat di jalur itu.',
    'en-US': 'A route cannot give away more than was recorded on it.',
  },
  'A payment route is no longer available. Reload and choose again.': {
    'id-ID': 'Ada jalur pembayaran yang tidak lagi tersedia. Muat ulang dan pilih lagi.',
    'en-US': 'A payment route is no longer available. Reload and choose again.',
  },
  'This transaction can no longer have its payments corrected.': {
    'id-ID': 'Pembayaran transaksi ini tidak dapat dikoreksi lagi.',
    'en-US': 'This transaction can no longer have its payments corrected.',
  },
  'You are not allowed to correct payments.': {
    'id-ID': 'Anda tidak memiliki izin untuk mengoreksi pembayaran.',
    'en-US': 'You are not allowed to correct payments.',
  },
  'Correction history': { 'id-ID': 'Riwayat koreksi', 'en-US': 'Correction history' },
  'Changes to record': { 'id-ID': 'Perubahan yang akan dicatat', 'en-US': 'Changes to record' },
  'Add payment method': { 'id-ID': 'Tambah metode pembayaran', 'en-US': 'Add payment method' },
  'Two route balance hint': {
    'id-ID': 'Ubah salah satu nominal, metode lainnya akan menyesuaikan otomatis.',
    'en-US': 'Change one amount and the other method adjusts automatically.',
  },
  'Remove payment method': { 'id-ID': 'Hapus metode pembayaran', 'en-US': 'Remove payment method' },
  'Left to allocate': { 'id-ID': 'Sisa yang perlu dialokasikan', 'en-US': 'Left to allocate' },
  'Allocated beyond the total paid': {
    'id-ID': 'Alokasi melebihi total dibayar',
    'en-US': 'Allocated beyond the total paid',
  },
  'Total changes': { 'id-ID': 'Total perubahan', 'en-US': 'Total changes' },
  'Nothing to change yet.': {
    'id-ID': 'Belum ada perubahan.',
    'en-US': 'Nothing to change yet.',
  },
  'Adjustment impact': { 'id-ID': 'Dampak penyesuaian', 'en-US': 'Adjustment impact' },
  'Changes are saved together when you save the adjustment.': {
    'id-ID': 'Perubahan disimpan bersamaan saat penyesuaian disimpan.',
    'en-US': 'Changes are saved together when you save the adjustment.',
  },
  'Changes are saved together when you save the adjustment. Items already paid stay on the payment record.':
    {
      'id-ID':
        'Perubahan disimpan bersamaan saat penyesuaian disimpan. Item yang sudah dibayar tetap tercatat pada pembayaran.',
      'en-US':
        'Changes are saved together when you save the adjustment. Items already paid stay on the payment record.',
    },
  'Previous total': { 'id-ID': 'Total sebelumnya', 'en-US': 'Previous total' },
  'Total after adjustment': {
    'id-ID': 'Total setelah penyesuaian',
    'en-US': 'Total after adjustment',
  },
  'Remaining to pay': { 'id-ID': 'Sisa tagihan', 'en-US': 'Remaining to pay' },
  'Paid in full': { 'id-ID': 'Lunas', 'en-US': 'Paid in full' },
  'Refunded to customer': { 'id-ID': 'Dana dikembalikan', 'en-US': 'Refunded to customer' },
  'A refund of': { 'id-ID': 'Pengembalian dana', 'en-US': 'A refund of' },
  'All items will be removed': {
    'id-ID': 'Semua item akan dihapus',
    'en-US': 'All items will be removed',
  },
  'This transaction no longer has any items. Saving will cancel the transaction.': {
    'id-ID':
      'Transaksi ini tidak lagi memiliki item. Menyimpan perubahan akan membatalkan transaksi.',
    'en-US': 'This transaction no longer has any items. Saving will cancel the transaction.',
  },
  'The transaction will be canceled': {
    'id-ID': 'Transaksi akan dibatalkan',
    'en-US': 'The transaction will be canceled',
  },
  'Original payment': {
    'id-ID': 'Pembayaran awal',
    'en-US': 'Original payment',
  },
  'Returned through': {
    'id-ID': 'Dikembalikan melalui',
    'en-US': 'Returned through',
  },
  'From account': {
    'id-ID': 'Dari akun',
    'en-US': 'From account',
  },
  'Reference (optional)': {
    'id-ID': 'Referensi (opsional)',
    'en-US': 'Reference (optional)',
  },
  'Note (optional)': {
    'id-ID': 'Catatan (opsional)',
    'en-US': 'Note (optional)',
  },
  'The refund is recorded manually: hand the money over yourself from the chosen account.': {
    'id-ID':
      'Pengembalian dana dicatat manual: serahkan dana kepada pelanggan dari akun yang dipilih.',
    'en-US':
      'The refund is recorded manually: hand the money over yourself from the chosen account.',
  },
  'No active cash or bank-transfer account is available for refunds at this location.': {
    'id-ID':
      'Belum ada akun tunai atau transfer bank yang aktif untuk pengembalian dana di lokasi ini.',
    'en-US': 'No active cash or bank-transfer account is available for refunds at this location.',
  },
  'Canceling this transaction requires the void permission.': {
    'id-ID': 'Membatalkan transaksi ini memerlukan izin pembatalan transaksi.',
    'en-US': 'Canceling this transaction requires the void permission.',
  },
  'Manual refund': {
    'id-ID': 'Pengembalian manual',
    'en-US': 'Manual refund',
  },
  'Refund movement': { 'id-ID': 'Pengembalian', 'en-US': 'Refund' },
  'Net paid amount': { 'id-ID': 'Dibayar bersih', 'en-US': 'Net paid' },
  'Net already paid': { 'id-ID': 'Sudah dibayar bersih', 'en-US': 'Net already paid' },
  'Refund recorded': {
    'id-ID': 'Pengembalian dana dicatat',
    'en-US': 'Refund recorded',
  },
  'Choose how and from which account the refund is returned.': {
    'id-ID': 'Pilih cara dan akun untuk mengembalikan dana.',
    'en-US': 'Choose how and from which account the refund is returned.',
  },
  'The refund account is not an active refund account of this location.': {
    'id-ID': 'Akun pengembalian dana tidak aktif atau bukan milik lokasi ini.',
    'en-US': 'The refund account is not an active refund account of this location.',
  },
  'is required.': { 'id-ID': 'diperlukan.', 'en-US': 'is required.' },
  'Your account does not have permission to refund payments.': {
    'id-ID': 'Akun Anda tidak memiliki izin untuk melakukan pengembalian dana.',
    'en-US': 'Your account does not have permission to refund payments.',
  },
  'Ask a supervisor to complete this adjustment.': {
    'id-ID': 'Minta supervisor untuk menyelesaikan penyesuaian ini.',
    'en-US': 'Ask a supervisor to complete this adjustment.',
  },
  'Reload transaction': { 'id-ID': 'Muat ulang transaksi', 'en-US': 'Reload transaction' },
  Recalculate: { 'id-ID': 'Hitung ulang', 'en-US': 'Recalculate' },
  'Calculating the adjustment…': {
    'id-ID': 'Menghitung penyesuaian…',
    'en-US': 'Calculating the adjustment…',
  },
  'The adjustment could not be calculated. Try again.': {
    'id-ID': 'Penyesuaian tidak dapat dihitung. Coba lagi.',
    'en-US': 'The adjustment could not be calculated. Try again.',
  },
  'The adjustment could not be saved. Try again.': {
    'id-ID': 'Gagal menyimpan penyesuaian. Coba lagi.',
    'en-US': 'The adjustment could not be saved. Try again.',
  },
  'The adjustment total changed since it was reviewed. Review it again before saving.': {
    'id-ID': 'Total penyesuaian berubah sejak ditinjau. Tinjau kembali sebelum menyimpan.',
    'en-US': 'The adjustment total changed since it was reviewed. Review it again before saving.',
  },
  'Returning money requires the payment refund permission.': {
    'id-ID': 'Pengembalian dana memerlukan izin pengembalian pembayaran.',
    'en-US': 'Returning money requires the payment refund permission.',
  },
  'The adjustment is not valid. Reload the transaction and try again.': {
    'id-ID': 'Penyesuaian tidak valid. Muat ulang transaksi lalu coba lagi.',
    'en-US': 'The adjustment is not valid. Reload the transaction and try again.',
  },
  'This change cannot be applied to the transaction.': {
    'id-ID': 'Perubahan ini tidak dapat diterapkan pada transaksi.',
    'en-US': 'This change cannot be applied to the transaction.',
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
  'Use for all work': { 'id-ID': 'Pakai untuk semua pengerjaan', 'en-US': 'Use for all work' },
  'Applies to': { 'id-ID': 'Berlaku untuk', 'en-US': 'Applies to' },
  services: { 'id-ID': 'layanan', 'en-US': 'services' },
  Employees: { 'id-ID': 'Karyawan', 'en-US': 'Employees' },
  'employees selected': { 'id-ID': 'dipilih', 'en-US': 'employees selected' },
  'Search employee': { 'id-ID': 'Cari karyawan', 'en-US': 'Search employee' },
  'No employee matches this name or code.': {
    'id-ID': 'Tidak ada karyawan dengan nama atau kode itu.',
    'en-US': 'No employee matches this name or code.',
  },
  'Search name or code': { 'id-ID': 'Cari nama atau kode', 'en-US': 'Search name or code' },
  chosen: { 'id-ID': 'dipilih', 'en-US': 'chosen' },
  'Clear search': { 'id-ID': 'Hapus pencarian', 'en-US': 'Clear search' },
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
  'All work': { 'id-ID': 'Semua pengerjaan', 'en-US': 'All work' },
  'Shared work': { 'id-ID': 'Dikerjakan bersama', 'en-US': 'Shared work' },
  'work set': { 'id-ID': 'pengerjaan sudah diatur', 'en-US': 'work set' },
  'Paper width': { 'id-ID': 'Lebar kertas', 'en-US': 'Paper width' },
  'Send receipt': { 'id-ID': 'Kirim struk', 'en-US': 'Send receipt' },
  'Edit customer': { 'id-ID': 'Edit pelanggan', 'en-US': 'Edit customer' },
  'Customer updated': { 'id-ID': 'Pelanggan diperbarui', 'en-US': 'Customer updated' },
  'Send receipt to customer': {
    'id-ID': 'Kirim struk ke customer',
    'en-US': 'Send receipt to customer',
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
  'Partial payment': { 'id-ID': 'Bayar sebagian', 'en-US': 'Partial payment' },
  'Payment allocation': { 'id-ID': 'Cara pembayaran', 'en-US': 'Payment allocation' },
  'Pay full remaining balance': {
    'id-ID': 'Bayar seluruh sisa tagihan',
    'en-US': 'Pay the full remaining balance',
  },
  'No payment amount needs to be entered.': {
    'id-ID': 'Nominal otomatis mengikuti sisa tagihan, jadi tidak perlu diisi.',
    'en-US':
      'The amount follows the remaining balance automatically, so no amount needs to be entered.',
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
  'Awaiting settlement': { 'id-ID': 'Menunggu pelunasan', 'en-US': 'Awaiting settlement' },
  'Refund and cancel': { 'id-ID': 'Kembalikan dana & batalkan', 'en-US': 'Refund and cancel' },
  'Already received': { 'id-ID': 'Sudah diterima', 'en-US': 'Already received' },
  'To be refunded': { 'id-ID': 'Akan dikembalikan', 'en-US': 'To be refunded' },
  'I have returned': { 'id-ID': 'Saya sudah mengembalikan', 'en-US': 'I have returned' },
  'to the customer.': {
    'id-ID': 'kepada pelanggan secara langsung.',
    'en-US': 'to the customer.',
  },
  'Load more awaiting settlement': {
    'id-ID': 'Muat transaksi menunggu pelunasan lainnya',
    'en-US': 'Load more awaiting settlement',
  },
  remaining: { 'id-ID': 'tersisa', 'en-US': 'remaining' },
  Refunded: { 'id-ID': 'Dikembalikan', 'en-US': 'Refunded' },
  'Partially refunded': { 'id-ID': 'Dikembalikan sebagian', 'en-US': 'Partially refunded' },
  'Total returned': { 'id-ID': 'Total dikembalikan', 'en-US': 'Total returned' },
  'Net received': { 'id-ID': 'Bersih diterima', 'en-US': 'Net received' },
  'Completed before cancellation': {
    'id-ID': 'Selesai sebelum pembatalan',
    'en-US': 'Completed before cancellation',
  },
  'Cancelled on': { 'id-ID': 'Dibatalkan pada', 'en-US': 'Cancelled on' },
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
  'Payment attempts': {
    'id-ID': 'Percobaan pembayaran',
    'en-US': 'Payment attempts',
  },
  'Item quantity': { 'id-ID': 'Jumlah', 'en-US': 'Quantity' },
  'Sold by': { 'id-ID': 'Dijual oleh', 'en-US': 'Sold by' },
  'No salesperson': { 'id-ID': 'Tanpa penjual', 'en-US': 'No salesperson' },
  'Same as main service': { 'id-ID': 'Sama dengan layanan utama', 'en-US': 'Same as main service' },
  'Main service performer not chosen yet': {
    'id-ID': 'Pelaksana layanan utama belum dipilih',
    'en-US': 'Main service performer not chosen yet',
  },
  'Choose other employees': { 'id-ID': 'Pilih karyawan lain', 'en-US': 'Choose other employees' },
  'Done by whoever performs the main service.': {
    'id-ID': 'Dikerjakan oleh pelaksana layanan utama.',
    'en-US': 'Done by whoever performs the main service.',
  },
  'Choose at least one employee, or use the main service performers.': {
    'id-ID': 'Pilih minimal satu karyawan, atau gunakan pelaksana layanan utama.',
    'en-US': 'Choose at least one employee, or use the main service performers.',
  },
  'Not decided yet': { 'id-ID': 'Belum ditentukan', 'en-US': 'Not decided yet' },
  'Follows main service': { 'id-ID': 'Mengikuti layanan utama', 'en-US': 'Follows main service' },
  'Same employees, different shares': {
    'id-ID': 'Karyawan sama, porsi berbeda',
    'en-US': 'Same employees, different shares',
  },
  Currently: { 'id-ID': 'Saat ini', 'en-US': 'Currently' },
  'Performers are not available for this transaction.': {
    'id-ID': 'Pelaksana tidak dapat diubah untuk transaksi ini.',
    'en-US': 'Performers are not available for this transaction.',
  },
  'Who performs this additional item?': {
    'id-ID': 'Siapa yang mengerjakan item tambahan ini?',
    'en-US': 'Who performs this additional item?',
  },
  'Choose who performs it.': {
    'id-ID': 'Pilih siapa yang mengerjakannya.',
    'en-US': 'Choose who performs it.',
  },
  'Decide who performs this additional item before continuing.': {
    'id-ID': 'Tentukan siapa yang mengerjakan item tambahan ini sebelum melanjutkan.',
    'en-US': 'Decide who performs this additional item before continuing.',
  },
  'Optional. The salesperson earns commission when the sale is completed.': {
    'id-ID': 'Opsional. Penjual memperoleh komisi saat transaksi selesai.',
    'en-US': 'Optional. The salesperson earns commission when the sale is completed.',
  },
  'Included components': { 'id-ID': 'Komponen termasuk', 'en-US': 'Included components' },
  'Required additional items': {
    'id-ID': 'Item tambahan wajib',
    'en-US': 'Required additional items',
  },
  'Choose at least one additional item.': {
    'id-ID': 'Pilih minimal satu item tambahan.',
    'en-US': 'Choose at least one additional item.',
  },
  'Search additional item': { 'id-ID': 'Cari item tambahan', 'en-US': 'Search additional item' },
  'Additional item': { 'id-ID': 'Item tambahan', 'en-US': 'Additional item' },
  'Additional items total': { 'id-ID': 'Item tambahan', 'en-US': 'Additional items' },
  'Add another item': { 'id-ID': 'Tambah item lain', 'en-US': 'Add another item' },
  'Remove additional item': { 'id-ID': 'Hapus item tambahan', 'en-US': 'Remove additional item' },
  'Service price': { 'id-ID': 'Harga jasa', 'en-US': 'Service price' },
  'Price per unit': { 'id-ID': 'Harga per unit', 'en-US': 'Price per unit' },
  'Item total': { 'id-ID': 'Total item', 'en-US': 'Item total' },
  'Choose a variant': { 'id-ID': 'Pilih varian', 'en-US': 'Choose a variant' },
  'No matching items': { 'id-ID': 'Tidak ada item yang cocok.', 'en-US': 'No matching items.' },
  'Price for this selection is unavailable.': {
    'id-ID': 'Harga pilihan ini belum tersedia.',
    'en-US': 'Price for this selection is unavailable.',
  },
  Used: { 'id-ID': 'Digunakan', 'en-US': 'Used' },
  'Component usage': { 'id-ID': 'Pemakaian komponen', 'en-US': 'Component usage' },
  'Fixed component': { 'id-ID': 'Tetap', 'en-US': 'Fixed' },
  'Selected during transaction': {
    'id-ID': 'Dipilih saat transaksi',
    'en-US': 'Selected during transaction',
  },
  Unit: { 'id-ID': 'Unit', 'en-US': 'Unit' },
  of: { 'id-ID': 'dari', 'en-US': 'of' },
  'units ready': { 'id-ID': 'unit lengkap', 'en-US': 'units ready' },
  Incomplete: { 'id-ID': 'Belum lengkap', 'en-US': 'Incomplete' },
  'No additional items': { 'id-ID': 'Tanpa item tambahan', 'en-US': 'No additional items' },
  'Previous unit': { 'id-ID': 'Unit sebelumnya', 'en-US': 'Previous unit' },
  'Next unit': { 'id-ID': 'Unit berikutnya', 'en-US': 'Next unit' },
  Units: { 'id-ID': 'Unit', 'en-US': 'Units' },
  'Unit configuration': { 'id-ID': 'Konfigurasi unit', 'en-US': 'Unit configuration' },
  'Configure each unit': { 'id-ID': 'Atur setiap unit', 'en-US': 'Configure each unit' },
  'Each unit can have different additional items.': {
    'id-ID': 'Setiap unit boleh memakai item tambahan yang berbeda.',
    'en-US': 'Each unit can have different additional items.',
  },
  'Apply to all units': { 'id-ID': 'Terapkan ke semua unit', 'en-US': 'Apply to all units' },
  'The replacement item is no longer available.': {
    'id-ID': 'Item pengganti tidak lagi tersedia.',
    'en-US': 'The replacement item is no longer available.',
  },
  'The selected variant is no longer available.': {
    'id-ID': 'Varian yang dipilih sudah tidak tersedia.',
    'en-US': 'The selected variant is no longer available.',
  },
  'Item price was not found for this location.': {
    'id-ID': 'Harga item tidak ditemukan untuk lokasi ini.',
    'en-US': 'Item price was not found for this location.',
  },
  'The transaction item was not found.': {
    'id-ID': 'Baris transaksi tidak ditemukan.',
    'en-US': 'The transaction item was not found.',
  },
  'The transaction changed. Reload it before correcting.': {
    'id-ID': 'Transaksi telah berubah. Muat ulang sebelum melakukan koreksi.',
    'en-US': 'The transaction changed. Reload it before correcting.',
  },
  'The corrected total would be lower than the payments already received.': {
    'id-ID': 'Total setelah koreksi lebih kecil dari pembayaran yang sudah diterima.',
    'en-US': 'The corrected total would be lower than the payments already received.',
  },
  'This item cannot be corrected: its work is completed, a performer is assigned before work started, or a manual price or discount is set.':
    {
      'id-ID':
        'Item ini tidak dapat dikoreksi: pekerjaannya sudah selesai, pelaksana sudah ditetapkan sebelum pekerjaan dimulai, atau ada harga manual atau diskon.',
      'en-US':
        'This item cannot be corrected: its work is completed, a performer is assigned before work started, or a manual price or discount is set.',
    },
  'Enter the reason for this correction.': {
    'id-ID': 'Isi alasan koreksi.',
    'en-US': 'Enter the reason for this correction.',
  },
  'Correcting a transaction in progress needs the progressed adjustment permission.': {
    'id-ID':
      'Koreksi transaksi yang sedang dikerjakan memerlukan izin penyesuaian transaksi berjalan.',
    'en-US': 'Correcting a transaction in progress needs the progressed adjustment permission.',
  },
  'The lower total must be returned through the payment provider, which is not available here. Ask a supervisor.':
    {
      'id-ID':
        'Selisih harus dikembalikan melalui penyedia pembayaran, yang belum tersedia di sini. Hubungi supervisor.',
      'en-US':
        'The lower total must be returned through the payment provider, which is not available here. Ask a supervisor.',
    },
  'The transaction is already closed and cannot be changed.': {
    'id-ID': 'Transaksi sudah selesai dan tidak dapat diubah.',
    'en-US': 'The transaction is already closed and cannot be changed.',
  },
  'A payment is still waiting for confirmation.': {
    'id-ID': 'Ada pembayaran yang masih menunggu konfirmasi.',
    'en-US': 'A payment is still waiting for confirmation.',
  },
  'Choose an additional item for every unit that requires one.': {
    'id-ID': 'Pilih item tambahan untuk setiap unit yang mewajibkannya.',
    'en-US': 'Choose an additional item for every unit that requires one.',
  },
  'An additional item is no longer available.': {
    'id-ID': 'Ada item tambahan yang tidak lagi tersedia.',
    'en-US': 'An additional item is no longer available.',
  },
  'An additional item is already part of this item.': {
    'id-ID': 'Item tambahan sudah menjadi bagian dari item ini.',
    'en-US': 'An additional item is already part of this item.',
  },
  'An additional item was chosen twice.': {
    'id-ID': 'Ada item tambahan yang dipilih dua kali.',
    'en-US': 'An additional item was chosen twice.',
  },
  'An item cannot be its own additional item.': {
    'id-ID': 'Item tidak boleh menjadi item tambahannya sendiri.',
    'en-US': 'An item cannot be its own additional item.',
  },
  'An additional item is no longer active.': {
    'id-ID': 'Ada item tambahan yang sudah tidak aktif.',
    'en-US': 'An additional item is no longer active.',
  },
  'An additional item has no selling price at this location.': {
    'id-ID': 'Ada item tambahan yang belum memiliki harga jual di lokasi ini.',
    'en-US': 'An additional item has no selling price at this location.',
  },
  'Choose a variant for the additional item.': {
    'id-ID': 'Pilih varian untuk item tambahan.',
    'en-US': 'Choose a variant for the additional item.',
  },
  'The chosen variant of an additional item is not valid.': {
    'id-ID': 'Varian item tambahan yang dipilih tidak valid.',
    'en-US': 'The chosen variant of an additional item is not valid.',
  },
  'Use additional items': { 'id-ID': 'Gunakan item tambahan', 'en-US': 'Use additional items' },
  'Additional items are required for this item.': {
    'id-ID': 'Item ini wajib memakai item tambahan.',
    'en-US': 'Additional items are required for this item.',
  },
  'No eligible additional items are available for this branch. Set a selling price for a Product in Backoffice, then try again.':
    {
      'id-ID':
        'Belum ada item tambahan yang memenuhi syarat di cabang ini. Atur harga jual Product di Backoffice, lalu coba lagi.',
      'en-US':
        'No eligible additional items are available for this branch. Set a selling price for a Product in Backoffice, then try again.',
    },
  'Item price': { 'id-ID': 'Harga item', 'en-US': 'Item price' },
  'Save changes': { 'id-ID': 'Simpan perubahan', 'en-US': 'Save changes' },
  'Edit item': { 'id-ID': 'Ubah item', 'en-US': 'Edit item' },
  'The item could not be changed. Reload the transaction and try again.': {
    'id-ID': 'Item belum dapat diubah. Muat ulang transaksi lalu coba lagi.',
    'en-US': 'The item could not be changed. Reload the transaction and try again.',
  },
  'Additional items': { 'id-ID': 'Item tambahan', 'en-US': 'Additional items' },
  'add-ons': { 'id-ID': 'tambahan', 'en-US': 'add-ons' },
  'Additional items subtotal': { 'id-ID': 'Item tambahan', 'en-US': 'Additional items' },
  'Complete or remove the unfinished additional item.': {
    'id-ID': 'Lengkapi atau hapus item tambahan yang belum selesai.',
    'en-US': 'Complete or remove the unfinished additional item.',
  },
  'Variant-specific components': {
    'id-ID': 'Komponen khusus varian',
    'en-US': 'Variant-specific components',
  },
  'The fixed discount exceeds the base item price. Additional items do not count toward the discount limit. Change or remove the discount before continuing.':
    {
      'id-ID':
        'Nominal diskon melebihi harga dasar item. Item tambahan tidak termasuk dalam batas diskon. Ubah atau hapus diskon sebelum melanjutkan.',
      'en-US':
        'The fixed discount exceeds the base item price. Additional items do not count toward the discount limit. Change or remove the discount before continuing.',
    },
  'The transaction total needs updating because the item discount rule changed. Open the item discount, remove it, then apply the correct discount again. Check the new total before completing the payment.':
    {
      'id-ID':
        'Total transaksi perlu diperbarui karena aturan diskon item berubah. Buka diskon item, hapus lalu terapkan kembali diskon yang sesuai. Periksa total terbaru sebelum menyelesaikan pembayaran.',
      'en-US':
        'The transaction total needs updating because the item discount rule changed. Open the item discount, remove it, then apply the correct discount again. Check the new total before completing the payment.',
    },
  'The transaction total needs updating because the item discount rule changed. Ask a Manager or Owner to remove the item discount and apply it again, then check the new total before completing the payment.':
    {
      'id-ID':
        'Total transaksi perlu diperbarui karena aturan diskon item berubah. Minta Manajer atau Pemilik menghapus lalu menerapkan kembali diskon item, kemudian periksa total terbaru sebelum menyelesaikan pembayaran.',
      'en-US':
        'The transaction total needs updating because the item discount rule changed. Ask a Manager or Owner to remove the item discount and apply it again, then check the new total before completing the payment.',
    },
  'The transaction total needs updating because the item promotion rule changed. Select Update total, then check the new total before completing the payment.':
    {
      'id-ID':
        'Total transaksi perlu diperbarui karena aturan promo item berubah. Pilih Perbarui total, lalu periksa total terbaru sebelum menyelesaikan pembayaran.',
      'en-US':
        'The transaction total needs updating because the item promotion rule changed. Select Update total, then check the new total before completing the payment.',
    },
  'The transaction total needs updating because the item promotion rule changed. Ask a Manager or Owner to update the total, then check the new total before completing the payment.':
    {
      'id-ID':
        'Total transaksi perlu diperbarui karena aturan promo item berubah. Minta Manajer atau Pemilik memperbarui total, lalu periksa total terbaru sebelum menyelesaikan pembayaran.',
      'en-US':
        'The transaction total needs updating because the item promotion rule changed. Ask a Manager or Owner to update the total, then check the new total before completing the payment.',
    },
  'Complete the remaining payment before finishing this transaction.': {
    'id-ID': 'Selesaikan sisa pembayaran sebelum menyelesaikan transaksi ini.',
    'en-US': 'Complete the remaining payment before finishing this transaction.',
  },
  'Update total': {
    'id-ID': 'Perbarui total',
    'en-US': 'Update total',
  },
};

export function operationalPosCopy(value: string, locale: OperationalLocale): string | undefined {
  return posCopy[value]?.[locale];
}
