import { useRuntime } from '@digvation/business-runtime';

import { operationalPosCopy } from './operational-pos-copy';

export type OperationalLocale = 'id-ID' | 'en-US';
type LocalizedLabel = Record<OperationalLocale, string>;

const copy: Record<string, LocalizedLabel> = {
  Sales: { 'id-ID': 'Penjualan', 'en-US': 'Sales' },
  Sell: { 'id-ID': 'Jual', 'en-US': 'Sell' },
  Operations: { 'id-ID': 'Operasional', 'en-US': 'Operations' },
  Operational: { 'id-ID': 'Operational', 'en-US': 'Operational' },
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
  Close: { 'id-ID': 'Tutup', 'en-US': 'Close' },
  Remove: { 'id-ID': 'Hapus', 'en-US': 'Remove' },
  Apply: { 'id-ID': 'Terapkan', 'en-US': 'Apply' },
  Logout: { 'id-ID': 'Keluar', 'en-US': 'Logout' },
  'Not available': { 'id-ID': 'Tidak tersedia', 'en-US': 'Not available' },
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
  'Open account information': {
    'id-ID': 'Buka informasi akun',
    'en-US': 'Open account information',
  },
  'Account information': { 'id-ID': 'Informasi akun', 'en-US': 'Account information' },
  'Operational account information for the active session.': {
    'id-ID': 'Akun yang digunakan pada sesi ini.',
    'en-US': 'Account used for this session.',
  },
  'Request password change': { 'id-ID': 'Ubah kata sandi', 'en-US': 'Change password' },
  Branch: { 'id-ID': 'Cabang', 'en-US': 'Branch' },
  'Sign in to Operational': { 'id-ID': 'Masuk ke Operational', 'en-US': 'Sign in to Operational' },
  'Use your account to start working.': {
    'id-ID': 'Gunakan akun Anda untuk mulai bekerja.',
    'en-US': 'Use your account to start working.',
  },
  'Run the business today.': {
    'id-ID': 'Jalankan bisnis hari ini.',
    'en-US': 'Run the business today.',
  },
  'Selling, queue and service work in one place.': {
    'id-ID': 'Penjualan, antrian, dan pengerjaan layanan dalam satu tempat.',
    'en-US': 'Selling, queue and service work in one place.',
  },
  'Enter your user ID.': { 'id-ID': 'Isi ID pengguna.', 'en-US': 'Enter your user ID.' },
  'Enter your password.': { 'id-ID': 'Isi kata sandi.', 'en-US': 'Enter your password.' },
  'Enter your password': { 'id-ID': 'Masukkan kata sandi', 'en-US': 'Enter your password' },
  'User ID': { 'id-ID': 'ID pengguna', 'en-US': 'User ID' },
  'Username or email': { 'id-ID': 'Nama pengguna atau email', 'en-US': 'Username or email' },
  Password: { 'id-ID': 'Kata sandi', 'en-US': 'Password' },
  'Complete account details': {
    'id-ID': 'Lengkapi data akun',
    'en-US': 'Complete account details',
  },
  'Enter user ID and password.': {
    'id-ID': 'Isi ID pengguna dan kata sandi.',
    'en-US': 'Enter your user ID and password.',
  },
  'Invalid user ID or password.': {
    'id-ID': 'ID pengguna atau kata sandi tidak valid.',
    'en-US': 'Invalid user ID or password.',
  },
  'Sign in failed. Try again.': {
    'id-ID': 'Gagal masuk. Coba lagi.',
    'en-US': 'Sign in failed. Try again.',
  },
  'Sign in failed': { 'id-ID': 'Gagal masuk', 'en-US': 'Sign in failed' },
  'Signed in': { 'id-ID': 'Berhasil masuk', 'en-US': 'Signed in' },
  'Opening Operational...': {
    'id-ID': 'Membuka Operational...',
    'en-US': 'Opening Operational...',
  },
  'Signing in...': { 'id-ID': 'Masuk...', 'en-US': 'Signing in...' },
  'Sign in': { 'id-ID': 'Masuk', 'en-US': 'Sign in' },
  'Verifying operational access': {
    'id-ID': 'Memverifikasi akses operasional',
    'en-US': 'Verifying operational access',
  },
  'Operational access unavailable': {
    'id-ID': 'Akses operasional tidak tersedia',
    'en-US': 'Operational access unavailable',
  },
  'Operational context unavailable': {
    'id-ID': 'Konteks operasional belum tersedia',
    'en-US': 'Operational context unavailable',
  },
  'Please wait.': { 'id-ID': 'Mohon tunggu.', 'en-US': 'Please wait.' },
  'Contact an administrator if this access should be available.': {
    'id-ID': 'Hubungi administrator jika akses ini seharusnya tersedia.',
    'en-US': 'Contact an administrator if this access should be available.',
  },
  'Your session ended due to inactivity. Sign in again.': {
    'id-ID': 'Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali.',
    'en-US': 'Your session ended due to inactivity. Sign in again.',
  },
  'Your session has ended. Sign in again.': {
    'id-ID': 'Sesi telah berakhir. Silakan masuk kembali.',
    'en-US': 'Your session has ended. Sign in again.',
  },
  'Ending session': { 'id-ID': 'Mengakhiri sesi', 'en-US': 'Ending session' },
  'Redirecting to sign in...': {
    'id-ID': 'Mengalihkan ke halaman masuk...',
    'en-US': 'Redirecting to sign in...',
  },
  'Operational location access unavailable': {
    'id-ID': 'Akses lokasi operasional tidak tersedia',
    'en-US': 'Operational location access unavailable',
  },
  'This account has no authorized operational location.': {
    'id-ID': 'Akun ini belum memiliki lokasi operasional yang diizinkan.',
    'en-US': 'This account has no authorized operational location.',
  },
  'Logout failed': { 'id-ID': 'Gagal keluar', 'en-US': 'Logout failed' },
  'Try again.': { 'id-ID': 'Coba lagi.', 'en-US': 'Try again.' },
  'Email unavailable': { 'id-ID': 'Email tidak tersedia', 'en-US': 'Email unavailable' },
  'Contact an administrator to change your password.': {
    'id-ID': 'Hubungi administrator untuk mengubah kata sandi.',
    'en-US': 'Contact an administrator to change your password.',
  },
  'Request received': { 'id-ID': 'Permintaan diterima', 'en-US': 'Request received' },
  'Instructions will be sent to the account email.': {
    'id-ID': 'Instruksi akan dikirim ke email akun.',
    'en-US': 'Instructions will be sent to the account email.',
  },
  'Password change request failed': {
    'id-ID': 'Gagal meminta perubahan kata sandi',
    'en-US': 'Password change request failed',
  },
  'Try again or contact an administrator.': {
    'id-ID': 'Coba lagi atau hubungi administrator.',
    'en-US': 'Try again or contact an administrator.',
  },
  Cart: { 'id-ID': 'Keranjang', 'en-US': 'Cart' },
  Checkout: { 'id-ID': 'Pembayaran', 'en-US': 'Checkout' },
  Product: { 'id-ID': 'Produk', 'en-US': 'Product' },
  Service: { 'id-ID': 'Layanan', 'en-US': 'Service' },
  All: { 'id-ID': 'Semua', 'en-US': 'All' },
  'Search items...': { 'id-ID': 'Cari item...', 'en-US': 'Search items...' },
  'No items found': { 'id-ID': 'Item tidak ditemukan', 'en-US': 'No items found' },
  'Transaction needs attention': {
    'id-ID': 'Transaksi perlu diperiksa',
    'en-US': 'Transaction needs attention',
  },
  Retry: { 'id-ID': 'Coba lagi', 'en-US': 'Retry' },
  Continue: { 'id-ID': 'Lanjutkan', 'en-US': 'Continue' },
  Reviewed: { 'id-ID': 'Sudah ditinjau', 'en-US': 'Reviewed' },
  'Queue transactions': { 'id-ID': 'Antrian transaksi', 'en-US': 'Queue transactions' },
  'No queued transactions.': {
    'id-ID': 'Belum ada transaksi dalam antrian.',
    'en-US': 'No queued transactions.',
  },
  'Click to view active transactions.': {
    'id-ID': 'Buka untuk melihat transaksi yang sedang berjalan.',
    'en-US': 'Open to view active transactions.',
  },
  'Transactions appear here after they are created.': {
    'id-ID': 'Transaksi akan muncul di sini setelah dibuat.',
    'en-US': 'Transactions appear here after they are created.',
  },
  'Select products or services from the catalog.': {
    'id-ID': 'Pilih produk atau layanan dari katalog.',
    'en-US': 'Select products or services from the catalog.',
  },
  'Cart is empty': { 'id-ID': 'Keranjang kosong', 'en-US': 'Cart is empty' },
  Member: { 'id-ID': 'Member', 'en-US': 'Member' },
  'Non-member': { 'id-ID': 'Non-member', 'en-US': 'Non-member' },
  Customer: { 'id-ID': 'Pelanggan', 'en-US': 'Customer' },
  'Choose customer': { 'id-ID': 'Pilih pelanggan', 'en-US': 'Choose customer' },
  'Customer data is not available': {
    'id-ID': 'Data pelanggan tidak tersedia',
    'en-US': 'Customer data is not available',
  },
  'Choose the customer first': {
    'id-ID': 'Pilih pelanggan terlebih dahulu',
    'en-US': 'Choose the customer first',
  },
  'A transaction belongs to a customer. Fill in the name and WhatsApp number, or choose a member.':
    {
      'id-ID':
        'Transaksi selalu milik seorang pelanggan. Isi nama dan nomor WhatsApp, atau pilih member.',
      'en-US':
        'A transaction belongs to a customer. Fill in the name and WhatsApp number, or choose a member.',
    },
  'WhatsApp number': { 'id-ID': 'Nomor WhatsApp', 'en-US': 'WhatsApp number' },
  'Name and WhatsApp number are both required.': {
    'id-ID': 'Nama dan nomor WhatsApp wajib diisi.',
    'en-US': 'Name and WhatsApp number are both required.',
  },
  'Member lookup is not available yet': {
    'id-ID': 'Pencarian member belum tersedia',
    'en-US': 'Member lookup is not available yet',
  },
  'Member identity comes from the customer directory, which is not connected to this installation yet.':
    {
      'id-ID':
        'Identitas member berasal dari direktori pelanggan, yang belum terhubung pada instalasi ini.',
      'en-US':
        'Member identity comes from the customer directory, which is not connected to this installation yet.',
    },
  'Send via WhatsApp': { 'id-ID': 'Kirim via WhatsApp', 'en-US': 'Send via WhatsApp' },
  'Not available yet': { 'id-ID': 'Belum tersedia', 'en-US': 'Not available yet' },
  'Search name or phone number': {
    'id-ID': 'Cari nama atau nomor telepon',
    'en-US': 'Search name or phone number',
  },
  'Search by name, phone number, or member code.': {
    'id-ID': 'Cari berdasarkan nama, nomor telepon, atau kode member.',
    'en-US': 'Search by name, phone number, or member code.',
  },
  'Member not found.': { 'id-ID': 'Member tidak ditemukan.', 'en-US': 'Member not found.' },
  'Use customer': { 'id-ID': 'Gunakan pelanggan', 'en-US': 'Use customer' },
  'Customer name': { 'id-ID': 'Nama pelanggan', 'en-US': 'Customer name' },
  'Phone number': { 'id-ID': 'Nomor telepon', 'en-US': 'Phone number' },
  'No items selected': { 'id-ID': 'Belum ada item dipilih', 'en-US': 'No items selected' },
  'items selected': { 'id-ID': 'item dipilih', 'en-US': 'items selected' },
  'Price available when selected': {
    'id-ID': 'Harga tersedia saat dipilih',
    'en-US': 'Price available when selected',
  },
  Subtotal: { 'id-ID': 'Subtotal', 'en-US': 'Subtotal' },
  'Estimated subtotal': { 'id-ID': 'Estimasi subtotal', 'en-US': 'Estimated subtotal' },
  'Estimated total': { 'id-ID': 'Estimasi total', 'en-US': 'Estimated total' },
  Payment: { 'id-ID': 'Pembayaran', 'en-US': 'Payment' },
  'Payment method': { 'id-ID': 'Metode pembayaran', 'en-US': 'Payment method' },
  'Payment amount': { 'id-ID': 'Nominal pembayaran', 'en-US': 'Payment amount' },
  'Settlement account': { 'id-ID': 'Akun penerimaan', 'en-US': 'Settlement account' },
  'Split payment': { 'id-ID': 'Pembayaran terbagi', 'en-US': 'Split payment' },
  'Add another payment method for the remaining balance.': {
    'id-ID': 'Tambahkan metode pembayaran lain untuk sisa tagihan.',
    'en-US': 'Add another payment method for the remaining balance.',
  },
  'Change the payment amount below to split this transaction across multiple payment methods.': {
    'id-ID':
      'Ubah nominal pembayaran di bawah untuk membagi transaksi ke beberapa metode pembayaran.',
    'en-US':
      'Change the payment amount below to split this transaction across multiple payment methods.',
  },
  'Payment method unavailable': {
    'id-ID': 'Metode pembayaran tidak tersedia',
    'en-US': 'Payment method unavailable',
  },
  'Configure an active settlement account for this payment method.': {
    'id-ID': 'Konfigurasikan akun penerimaan aktif untuk metode pembayaran ini.',
    'en-US': 'Configure an active settlement account for this payment method.',
  },
  Cash: { 'id-ID': 'Tunai', 'en-US': 'Cash' },
  Transfer: { 'id-ID': 'Transfer', 'en-US': 'Transfer' },
  'Digital wallet': { 'id-ID': 'Dompet digital', 'en-US': 'Digital wallet' },
  'Pay now': { 'id-ID': 'Bayar sekarang', 'en-US': 'Pay now' },
  'Payment successful': { 'id-ID': 'Pembayaran berhasil', 'en-US': 'Payment successful' },
  'Payment failed': { 'id-ID': 'Pembayaran gagal', 'en-US': 'Payment failed' },
  'Payment complete': { 'id-ID': 'Pembayaran lunas', 'en-US': 'Payment complete' },
  'Payment recorded': { 'id-ID': 'Pembayaran dicatat', 'en-US': 'Payment recorded' },
  'Payment incomplete': { 'id-ID': 'Pembayaran belum selesai', 'en-US': 'Payment incomplete' },
  'Transaction completed': { 'id-ID': 'Transaksi selesai', 'en-US': 'Transaction completed' },
  'Transaction canceled': { 'id-ID': 'Transaksi dibatalkan', 'en-US': 'Transaction canceled' },
  'Complete transaction': { 'id-ID': 'Selesaikan transaksi', 'en-US': 'Complete transaction' },
  'Cancel transaction': { 'id-ID': 'Batalkan transaksi', 'en-US': 'Cancel transaction' },
  'Transaction details': { 'id-ID': 'Detail transaksi', 'en-US': 'Transaction details' },
  'Preview receipt': { 'id-ID': 'Pratinjau struk', 'en-US': 'Receipt preview' },
  Receipt: { 'id-ID': 'Struk', 'en-US': 'Receipt' },
  'View receipt': { 'id-ID': 'Lihat struk', 'en-US': 'View receipt' },
  Print: { 'id-ID': 'Cetak', 'en-US': 'Print' },
  'Paper size': { 'id-ID': 'Ukuran kertas', 'en-US': 'Paper size' },
  'Start work': { 'id-ID': 'Mulai pengerjaan', 'en-US': 'Start work' },
  'Work started': { 'id-ID': 'Pengerjaan dimulai', 'en-US': 'Work started' },
  'Adjust order': { 'id-ID': 'Sesuaikan pesanan', 'en-US': 'Adjust order' },
  'Pay balance': { 'id-ID': 'Bayar sisa', 'en-US': 'Pay balance' },
  Pay: { 'id-ID': 'Bayar', 'en-US': 'Pay' },
  Paid: { 'id-ID': 'Lunas', 'en-US': 'Paid' },
  'Partially paid': { 'id-ID': 'Bayar sebagian', 'en-US': 'Partially paid' },
  Unpaid: { 'id-ID': 'Belum dibayar', 'en-US': 'Unpaid' },
  'Order details': { 'id-ID': 'Detail pesanan', 'en-US': 'Order details' },
  Order: { 'id-ID': 'Pesanan', 'en-US': 'Order' },
  'Complete before starting': {
    'id-ID': 'Lengkapi sebelum mulai',
    'en-US': 'Complete before starting',
  },
  'Quantity must be greater than zero.': {
    'id-ID': 'Jumlah harus lebih dari nol.',
    'en-US': 'Quantity must be greater than zero.',
  },
  'Price is not available.': {
    'id-ID': 'Harga belum tersedia.',
    'en-US': 'Price is not available.',
  },
  'Only active transactions can be processed.': {
    'id-ID': 'Hanya transaksi aktif yang dapat diproses.',
    'en-US': 'Only active transactions can be processed.',
  },
  'Add at least one item.': {
    'id-ID': 'Tambahkan setidaknya satu item.',
    'en-US': 'Add at least one item.',
  },
  'Resolve pending payments.': {
    'id-ID': 'Selesaikan pembayaran yang masih menunggu.',
    'en-US': 'Resolve pending payments.',
  },
  'Payments must match the transaction total.': {
    'id-ID': 'Jumlah pembayaran harus sama dengan total transaksi.',
    'en-US': 'Payments must match the transaction total.',
  },
  'Complete all work before finishing the transaction.': {
    'id-ID': 'Selesaikan semua pengerjaan sebelum menutup transaksi.',
    'en-US': 'Complete all work before finishing the transaction.',
  },
  'Select an employee.': { 'id-ID': 'Pilih karyawan.', 'en-US': 'Select an employee.' },
  'Employee contribution must total 100%.': {
    'id-ID': 'Total kontribusi karyawan harus 100%.',
    'en-US': 'Employee contribution must total 100%.',
  },
  'Select variant': { 'id-ID': 'Pilih varian', 'en-US': 'Select variant' },
  'Select option': { 'id-ID': 'Pilih opsi', 'en-US': 'Select option' },
  'Choose option': { 'id-ID': 'Pilih opsi', 'en-US': 'Choose option' },
  Option: { 'id-ID': 'Opsi', 'en-US': 'Option' },
  'Without variant': { 'id-ID': 'Tanpa varian', 'en-US': 'Without variant' },
  'Sold as the item itself': {
    'id-ID': 'Dijual tanpa memilih varian',
    'en-US': 'Sold as the item itself',
  },
  'Select one option to add to the cart.': {
    'id-ID': 'Pilih satu opsi untuk ditambahkan ke keranjang.',
    'en-US': 'Select one option to add to the cart.',
  },
  'Select one option to add to the transaction.': {
    'id-ID': 'Pilih satu opsi untuk ditambahkan ke transaksi.',
    'en-US': 'Select one option to add to the transaction.',
  },
  'Select one variant to add to the transaction.': {
    'id-ID': 'Pilih satu varian untuk ditambahkan ke transaksi.',
    'en-US': 'Select one variant to add to the transaction.',
  },
  'Select one variant to add to the cart.': {
    'id-ID': 'Pilih satu varian untuk ditambahkan ke keranjang.',
    'en-US': 'Select one variant to add to the cart.',
  },
  'Price unavailable': { 'id-ID': 'Harga belum tersedia', 'en-US': 'Price unavailable' },
  'Add to transaction': { 'id-ID': 'Tambahkan ke transaksi', 'en-US': 'Add to transaction' },
  'Add to cart': { 'id-ID': 'Tambahkan ke keranjang', 'en-US': 'Add to cart' },
  'Transaction item': { 'id-ID': 'Item transaksi', 'en-US': 'Transaction item' },
  'Configure service workers, work status, price, or item discount.': {
    'id-ID': 'Atur pelaksana, status pekerjaan, harga, atau diskon item ini.',
    'en-US': 'Configure service workers, work status, price, or item discount.',
  },
  'Configure price or item discount.': {
    'id-ID': 'Atur harga atau diskon item ini.',
    'en-US': 'Configure price or item discount.',
  },
  'Service workers': { 'id-ID': 'Karyawan yang mengerjakan', 'en-US': 'Service workers' },
  'Select employees who perform this service. Leave shares blank to split evenly.': {
    'id-ID': 'Pilih karyawan yang mengerjakan jasa ini. Kosongkan porsi untuk membagi rata.',
    'en-US': 'Select employees who perform this service. Leave shares blank to split evenly.',
  },
  'Share (%)': { 'id-ID': 'Porsi (%)', 'en-US': 'Share (%)' },
  'Split evenly': { 'id-ID': 'Bagi rata', 'en-US': 'Split evenly' },
  'No active employees can perform this service.': {
    'id-ID': 'Belum ada karyawan aktif yang dapat mengerjakan jasa.',
    'en-US': 'No active employees can perform this service.',
  },
  'Save workers': { 'id-ID': 'Simpan karyawan', 'en-US': 'Save workers' },
  'No workers selected': { 'id-ID': 'Belum ada pelaksana dipilih', 'en-US': 'No workers selected' },
  'workers selected': { 'id-ID': 'pelaksana dipilih', 'en-US': 'workers selected' },
  'Service value allocation': {
    'id-ID': 'Pembagian nilai jasa',
    'en-US': 'Service value allocation',
  },
  'Work status': { 'id-ID': 'Status pekerjaan', 'en-US': 'Work status' },
  'Current status': { 'id-ID': 'Saat ini', 'en-US': 'Current status' },
  'Mark complete': { 'id-ID': 'Tandai selesai', 'en-US': 'Mark complete' },
  'Cancel work': { 'id-ID': 'Batalkan pekerjaan', 'en-US': 'Cancel work' },
  'No further status changes are available.': {
    'id-ID': 'Tidak ada perubahan status berikutnya untuk pekerjaan ini.',
    'en-US': 'No further status changes are available.',
  },
  'Price adjustment': { 'id-ID': 'Penyesuaian harga', 'en-US': 'Price adjustment' },
  'Set a transaction-specific price without changing the catalog price.': {
    'id-ID': 'Ubah harga untuk transaksi ini tanpa mengubah harga katalog.',
    'en-US': 'Set a transaction-specific price without changing the catalog price.',
  },
  'Unit price': { 'id-ID': 'Harga per unit', 'en-US': 'Unit price' },
  Reason: { 'id-ID': 'Alasan', 'en-US': 'Reason' },
  'Item discount': { 'id-ID': 'Diskon item', 'en-US': 'Item discount' },
  Discount: { 'id-ID': 'Diskon', 'en-US': 'Discount' },
  'Discount information': { 'id-ID': 'Informasi diskon', 'en-US': 'Discount information' },
  Start: { 'id-ID': 'Mulai', 'en-US': 'Start' },
  End: { 'id-ID': 'Berakhir', 'en-US': 'End' },
  Percentage: { 'id-ID': 'Persentase', 'en-US': 'Percentage' },
  'Fixed amount': { 'id-ID': 'Nominal', 'en-US': 'Fixed amount' },
  'Discount reason': { 'id-ID': 'Alasan diskon', 'en-US': 'Discount reason' },
  'Apply discount': { 'id-ID': 'Terapkan diskon', 'en-US': 'Apply discount' },
  'Select at least one service worker.': {
    'id-ID': 'Pilih minimal satu pelaksana untuk jasa ini.',
    'en-US': 'Select at least one service worker.',
  },
  'Worker share must be greater than 0% and at most 100%.': {
    'id-ID': 'Porsi pelaksana harus lebih dari 0% dan tidak lebih dari 100%.',
    'en-US': 'Worker share must be greater than 0% and at most 100%.',
  },
  'When all shares are entered, the total must be exactly 100%.': {
    'id-ID': 'Jika semua porsi diisi, total porsi harus tepat 100%.',
    'en-US': 'When all shares are entered, the total must be exactly 100%.',
  },
  'Leave room for workers whose share is split automatically.': {
    'id-ID': 'Sisakan porsi untuk pelaksana yang dibagi otomatis.',
    'en-US': 'Leave room for workers whose share is split automatically.',
  },
  'Discount value and reason are required. Percentage must be between 0 and 100%.': {
    'id-ID': 'Nilai diskon dan alasan wajib diisi. Persentase harus antara 0 dan 100%.',
    'en-US': 'Discount value and reason are required. Percentage must be between 0 and 100%.',
  },
  'Price and reason are required.': {
    'id-ID': 'Harga dan alasan penyesuaian wajib diisi.',
    'en-US': 'Price and reason are required.',
  },
  'This transaction is already closed.': {
    'id-ID': 'Transaksi ini sudah ditutup.',
    'en-US': 'This transaction is already closed.',
  },
  'Reconnect before changing this transaction.': {
    'id-ID': 'Sambungkan kembali perangkat sebelum mengubah transaksi.',
    'en-US': 'Reconnect before changing this transaction.',
  },
  'Review the latest changes before continuing.': {
    'id-ID': 'Periksa perubahan terbaru sebelum melanjutkan.',
    'en-US': 'Review the latest changes before continuing.',
  },
  'Wait for the current change to finish.': {
    'id-ID': 'Tunggu perubahan saat ini selesai.',
    'en-US': 'Wait for the current change to finish.',
  },
  'Complete the transaction before continuing.': {
    'id-ID': 'Lengkapi transaksi sebelum melanjutkan.',
    'en-US': 'Complete the transaction before continuing.',
  },
  'There is no remaining amount to pay.': {
    'id-ID': 'Tidak ada sisa pembayaran.',
    'en-US': 'There is no remaining amount to pay.',
  },
  'Transactions with payments cannot be canceled.': {
    'id-ID': 'Transaksi dengan pembayaran tidak dapat dibatalkan.',
    'en-US': 'Transactions with payments cannot be canceled.',
  },
  'Start a new transaction? The current transaction will remain open.': {
    'id-ID': 'Mulai transaksi baru? Transaksi saat ini tetap berjalan.',
    'en-US': 'Start a new transaction? The current transaction will remain open.',
  },
  'Finish adjusting the transaction before adding items to the cart.': {
    'id-ID': 'Selesaikan penyesuaian transaksi sebelum menambahkan item ke keranjang.',
    'en-US': 'Finish adjusting the transaction before adding items to the cart.',
  },
  'The transaction being adjusted is no longer active. Reopen the adjustment.': {
    'id-ID': 'Transaksi yang akan disesuaikan tidak lagi aktif. Buka kembali penyesuaian.',
    'en-US': 'The transaction being adjusted is no longer active. Reopen the adjustment.',
  },
  'The latest transaction could not be loaded.': {
    'id-ID': 'Transaksi terbaru tidak dapat dimuat.',
    'en-US': 'The latest transaction could not be loaded.',
  },
  'The latest transaction cannot accept another payment.': {
    'id-ID': 'Transaksi ini belum dapat menerima pembayaran berikutnya.',
    'en-US': 'The latest transaction cannot accept another payment.',
  },
  'No queued work remains to start.': {
    'id-ID': 'Tidak ada pekerjaan dalam antrian yang dapat dimulai.',
    'en-US': 'No queued work remains to start.',
  },
  'Start all work before completing the transaction.': {
    'id-ID': 'Mulai semua pekerjaan sebelum menyelesaikan transaksi.',
    'en-US': 'Start all work before completing the transaction.',
  },
  'Canceled work cannot be completed as an active transaction.': {
    'id-ID': 'Pekerjaan yang dibatalkan tidak dapat diselesaikan sebagai transaksi aktif.',
    'en-US': 'Canceled work cannot be completed as an active transaction.',
  },
  'A payment is still pending. Wait for it to settle before trying again.': {
    'id-ID': 'Pembayaran masih menunggu. Tunggu hingga selesai sebelum mencoba lagi.',
    'en-US': 'A payment is still pending. Wait for it to settle before trying again.',
  },
  Workshop: { 'id-ID': 'Bengkel', 'en-US': 'Workshop' },
  Intake: { 'id-ID': 'Penerimaan', 'en-US': 'Intake' },
  'Keluhan / Permintaan Customer sebelum diagnosis mekanik.': {
    'id-ID': 'Terima kendaraan, lalu mulai Work Order.',
    'en-US': 'Record the customer, vehicle, and complaint before the mechanic\'s diagnosis.',
  },
  'Keluhan / Permintaan Customer': {
    'id-ID': 'Keluhan',
    'en-US': 'Customer complaint',
  },
  'Select a Location to continue.': {
    'id-ID': 'Pilih cabang aktif dulu.',
    'en-US': 'Choose an active branch first.',
  },
  'New customer': { 'id-ID': 'Pelanggan baru', 'en-US': 'New customer' },
  'Find customer': { 'id-ID': 'Cari pelanggan', 'en-US': 'Find customer' },
  'Find an existing customer or add a new customer.': {
    'id-ID': 'Cari pelanggan yang sudah ada atau buat pelanggan baru.',
    'en-US': 'Find an existing customer or add a new customer.',
  },
  'Work Order': { 'id-ID': 'Work Order', 'en-US': 'Work Order' },
  'Track workshop jobs from vehicle arrival to completion.': {
    'id-ID': 'Pantau pekerjaan bengkel dari kendaraan masuk hingga selesai.',
    'en-US': 'Track workshop jobs from vehicle arrival to completion.',
  },
  'Customer name or phone number...': {
    'id-ID': 'Nama atau nomor telepon...',
    'en-US': 'Customer name or phone number...',
  },
  'Write the complaint or request from the customer.': {
    'id-ID': 'Tulis keluhan atau permintaan pelanggan.',
    'en-US': 'Write the complaint or request from the customer.',
  },
  'Example: Budi Santoso': { 'id-ID': 'Contoh: Budi Santoso', 'en-US': 'Example: Budi Santoso' },
  'Enter a valid phone number': {
    'id-ID': 'Nomor telepon tidak valid',
    'en-US': 'Enter a valid phone number',
  },
  'Enter chassis number': { 'id-ID': 'Masukkan nomor rangka', 'en-US': 'Enter chassis number' },
  'Enter engine number': { 'id-ID': 'Masukkan nomor mesin', 'en-US': 'Enter engine number' },
  'Available customers': { 'id-ID': 'Pelanggan', 'en-US': 'Available customers' },
  'Could not load customers.': {
    'id-ID': 'Gagal memuat pelanggan.',
    'en-US': 'Could not load customers.',
  },
  'No customers found. Try another search.': {
    'id-ID': 'Pelanggan tidak ditemukan. Coba kata pencarian lain.',
    'en-US': 'No customers found. Try another search.',
  },
  'Customer not found? Use the New customer tab to add one.': {
    'id-ID':
      'Tidak menemukan pelanggan? Gunakan tab Pelanggan baru untuk menambahkan pelanggan baru.',
    'en-US': 'Customer not found? Use the New customer tab to add one.',
  },
  'Continue to Vehicle': {
    'id-ID': 'Lanjut ke Kendaraan',
    'en-US': 'Continue to Vehicle',
  },
  'Continue to Complaint': {
    'id-ID': 'Lanjut ke Keluhan',
    'en-US': 'Continue to Complaint',
  },
  'Complaint & Summary': {
    'id-ID': 'Keluhan & Ringkasan',
    'en-US': 'Complaint & Summary',
  },
  'Choose vehicle': { 'id-ID': 'Pilih kendaraan', 'en-US': 'Choose vehicle' },
  'Select a saved vehicle or add a new vehicle.': {
    'id-ID': 'Pilih kendaraan tersimpan atau tambahkan kendaraan baru.',
    'en-US': 'Select a saved vehicle or add a new vehicle.',
  },
  'New vehicle': { 'id-ID': 'Kendaraan baru', 'en-US': 'New vehicle' },
  'Available vehicles': { 'id-ID': 'Kendaraan', 'en-US': 'Available vehicles' },
  'Could not load vehicles.': {
    'id-ID': 'Gagal memuat kendaraan.',
    'en-US': 'Could not load vehicles.',
  },
  'No saved vehicles found. Use the New vehicle tab to add one.': {
    'id-ID': 'Kendaraan tersimpan tidak ditemukan. Gunakan tab Kendaraan baru untuk menambahkannya.',
    'en-US': 'No saved vehicles found. Use the New vehicle tab to add one.',
  },
  'Review the customer and vehicle, then record the complaint.': {
    'id-ID': 'Periksa pelanggan dan kendaraan, lalu catat keluhannya.',
    'en-US': 'Review the customer and vehicle, then record the complaint.',
  },
  'Search Work Orders, customers, or vehicles': {
    'id-ID': 'Cari no. Work Order, pelanggan, atau kendaraan',
    'en-US': 'Search Work Orders, customers, or vehicles',
  },
  Phone: { 'id-ID': 'Telepon', 'en-US': 'Phone' },
  'Select a Customer first.': {
    'id-ID': 'Pilih pelanggan dulu.',
    'en-US': 'Select a Customer first.',
  },
  'Add new vehicle': { 'id-ID': 'Tambah kendaraan', 'en-US': 'Add new vehicle' },
  'Plate number': { 'id-ID': 'Plat nomor', 'en-US': 'Plate number' },
  'Chassis number': { 'id-ID': 'Nomor rangka', 'en-US': 'Chassis number' },
  'Engine number': { 'id-ID': 'Nomor mesin', 'en-US': 'Engine number' },
  'For example, rem bunyi': {
    'id-ID': 'Contoh: rem berbunyi saat pedal diinjak',
    'en-US': 'For example, brakes are noisy',
  },
  'Create Work Order': { 'id-ID': 'Buat Work Order', 'en-US': 'Create Work Order' },
  'Work Order created': { 'id-ID': 'Work Order dibuat', 'en-US': 'Work Order created' },
  'Work Order number': { 'id-ID': 'Nomor Work Order', 'en-US': 'Work Order number' },
  'Customer created.': { 'id-ID': 'Pelanggan ditambahkan.', 'en-US': 'Customer created.' },
  'Could not create Customer.': {
    'id-ID': 'Pelanggan belum tersimpan. Coba lagi.',
    'en-US': 'Could not create Customer.',
  },
  'Could not create Work Order. Try again.': {
    'id-ID': 'Work Order belum tersimpan. Coba lagi.',
    'en-US': 'Could not create Work Order. Try again.',
  },
  'Customer was not found. Search again.': {
    'id-ID': 'Pelanggan tidak ditemukan. Cari lagi.',
    'en-US': 'Customer was not found. Search again.',
  },
  'This Customer is not active.': {
    'id-ID': 'Pelanggan ini nonaktif.',
    'en-US': 'This Customer is not active.',
  },
  'Vehicle was not found. Search again.': {
    'id-ID': 'Kendaraan tidak ditemukan. Cari lagi.',
    'en-US': 'Vehicle was not found. Search again.',
  },
  'This Vehicle belongs to a different Customer.': {
    'id-ID': 'Kendaraan ini terdaftar atas pelanggan lain.',
    'en-US': 'This Vehicle belongs to a different Customer.',
  },
  'A Vehicle with this plate number already exists.': {
    'id-ID': 'Plat nomor ini sudah terdaftar.',
    'en-US': 'A Vehicle with this plate number already exists.',
  },
  'A Vehicle with this chassis number already exists.': {
    'id-ID': 'Nomor rangka ini sudah terdaftar.',
    'en-US': 'A Vehicle with this chassis number already exists.',
  },
  'A Vehicle with this engine number already exists.': {
    'id-ID': 'Nomor mesin ini sudah terdaftar.',
    'en-US': 'A Vehicle with this engine number already exists.',
  },
  'Check the Vehicle details and try again.': {
    'id-ID': 'Periksa data kendaraan, lalu coba lagi.',
    'en-US': 'Check the Vehicle details and try again.',
  },
  'This Location is not available to you.': {
    'id-ID': 'Anda tidak punya akses ke cabang ini.',
    'en-US': 'This Location is not available to you.',
  },
  'Could not submit. Try again.': {
    'id-ID': 'Data belum terkirim. Coba lagi.',
    'en-US': 'Could not submit. Try again.',
  },
  'Search plate, chassis, or engine number': { 'id-ID': 'Cari plat, no. rangka, atau no. mesin', 'en-US': 'Search plate, chassis, or engine number' },
  'Save customer': { 'id-ID': 'Simpan pelanggan', 'en-US': 'Save customer' },
  'Change': { 'id-ID': 'Ganti', 'en-US': 'Change' },
  'Use a saved vehicle': { 'id-ID': 'Pakai kendaraan tersimpan', 'en-US': 'Use a saved vehicle' },
  'View queue': { 'id-ID': 'Lihat Antrean', 'en-US': 'View queue' },
  'Create another Work Order': { 'id-ID': 'Buat Work Order lagi', 'en-US': 'Create another Work Order' },
  'Open queue': { 'id-ID': 'Buka Antrean', 'en-US': 'Open queue' },
  'What is the customer complaint?': { 'id-ID': 'Apa keluhan pelanggan?', 'en-US': 'What is the customer complaint?' },
  'Select a Vehicle first.': { 'id-ID': 'Pilih kendaraan dulu.', 'en-US': 'Select a Vehicle first.' },
  'Keluhan': { 'id-ID': 'Keluhan', 'en-US': 'Complaint' },
  'Recent Work Orders': { 'id-ID': 'Work Order terbaru', 'en-US': 'Recent Work Orders' },
  'Could not load recent Work Orders.': { 'id-ID': 'Gagal memuat Work Order terbaru.', 'en-US': 'Could not load recent Work Orders.' },
  'Start the first one with the Create Work Order button.': { 'id-ID': 'Buat yang pertama dengan tombol Buat Work Order.', 'en-US': 'Start the first one with the Create Work Order button.' },
  'New Work Order': { 'id-ID': 'Work Order baru', 'en-US': 'New Work Order' },
  'Saved vehicles': { 'id-ID': 'Kendaraan tersimpan', 'en-US': 'Saved vehicles' },
  Queue: { 'id-ID': 'Antrean', 'en-US': 'Queue' },
  'Work Orders at the active branch.': {
    'id-ID': 'Work Order di cabang aktif.',
    'en-US': 'Work Orders at the active branch.',
  },
  'Search by Work Order number': {
    'id-ID': 'Cari nomor Work Order',
    'en-US': 'Search by Work Order number',
  },
  'All statuses': { 'id-ID': 'Semua status', 'en-US': 'All statuses' },
  'No Work Orders match the current filters.': {
    'id-ID': 'Tidak ada Work Order yang cocok. Ubah pencarian atau filter.',
    'en-US': 'No Work Orders match the current filters.',
  },
  'No Work Orders at this branch yet.': {
    'id-ID': 'Belum ada Work Order di cabang ini.',
    'en-US': 'No Work Orders at this branch yet.',
  },
  'Could not load the Workshop queue.': {
    'id-ID': 'Gagal memuat antrean',
    'en-US': 'Could not load the Workshop queue.',
  },
  'Check your connection, then try again.': {
    'id-ID': 'Periksa koneksi, lalu coba lagi.',
    'en-US': 'Check your connection, then try again.',
  },
  Vehicle: { 'id-ID': 'Kendaraan', 'en-US': 'Vehicle' },
  Created: { 'id-ID': 'Dibuat', 'en-US': 'Created' },
  Pause: { 'id-ID': 'Jeda', 'en-US': 'Pause' },
  Resume: { 'id-ID': 'Lanjutkan', 'en-US': 'Resume' },
  Complete: { 'id-ID': 'Selesaikan', 'en-US': 'Complete' },
  'Cancel work order': {
    'id-ID': 'Batalkan Work Order',
    'en-US': 'Cancel work order',
  },
  'For example, the customer changed their mind.': {
    'id-ID': 'Contoh: pelanggan tidak jadi servis',
    'en-US': 'For example, the customer changed their mind.',
  },
  Back: { 'id-ID': 'Kembali', 'en-US': 'Back' },
  'Yes, cancel': {
    'id-ID': 'Ya, batalkan',
    'en-US': 'Yes, cancel',
  },
  'Work Order cancelled.': {
    'id-ID': 'Work Order dibatalkan.',
    'en-US': 'Work Order cancelled.',
  },
  'This Work Order was just changed. Open it again.': {
    'id-ID': 'Work Order ini baru saja berubah. Buka lagi untuk melihat data terbaru.',
    'en-US': 'This Work Order was just changed. Open it again.',
  },
  'This action is no longer available for the current Work Order status.': {
    'id-ID': 'Status Work Order sudah berubah, aksi ini tidak tersedia lagi.',
    'en-US': 'This action is no longer available for the current Work Order status.',
  },
  'Enter a reason to cancel this Work Order.': {
    'id-ID': 'Isi alasan pembatalan.',
    'en-US': 'Enter a reason to cancel this Work Order.',
  },
  'Could not update the Work Order. Try again.': {
    'id-ID': 'Perubahan belum tersimpan. Coba lagi.',
    'en-US': 'Could not update the Work Order. Try again.',
  },
  'No more actions for this Work Order.': {
    'id-ID': 'Tidak ada aksi lagi untuk Work Order ini.',
    'en-US': 'No more actions for this Work Order.',
  },
  'You do not have permission to change this Work Order.': {
    'id-ID': 'Anda tidak punya izin mengubah Work Order ini.',
    'en-US': 'You do not have permission to change this Work Order.',
  },
  Mechanic: { 'id-ID': 'Mekanik', 'en-US': 'Mechanic' },
  'Not assigned yet': { 'id-ID': 'Belum ada mekanik', 'en-US': 'Not assigned yet' },
  'Assign mechanic': { 'id-ID': 'Tugaskan mekanik', 'en-US': 'Assign mechanic' },
  'Replace mechanic': { 'id-ID': 'Ganti mekanik', 'en-US': 'Replace mechanic' },
  'Choose a mechanic': { 'id-ID': 'Pilih mekanik', 'en-US': 'Choose a mechanic' },
  Assign: { 'id-ID': 'Tugaskan', 'en-US': 'Assign' },
  Replace: { 'id-ID': 'Ganti', 'en-US': 'Replace' },
  'Working on': { 'id-ID': 'Sedang mengerjakan', 'en-US': 'Working on' },
  'Waiting for work': { 'id-ID': 'Belum ada pekerjaan berjalan', 'en-US': 'Waiting for work' },
  'open Work Orders': { 'id-ID': 'Work Order aktif', 'en-US': 'open Work Orders' },
  'Not enabled as a workshop mechanic.': {
    'id-ID': 'Belum diaktifkan sebagai mekanik bengkel.',
    'en-US': 'Not enabled as a workshop mechanic.',
  },
  'No mechanics yet. Enable mechanics from the Employee page in Backoffice.': {
    'id-ID': 'Belum ada mekanik. Aktifkan mekanik dari halaman Karyawan di Backoffice.',
    'en-US': 'No mechanics yet. Enable mechanics from the Employee page in Backoffice.',
  },
  'Could not load mechanics.': {
    'id-ID': 'Daftar mekanik belum bisa dimuat.',
    'en-US': 'Could not load mechanics.',
  },
  'Mechanic assigned.': { 'id-ID': 'Mekanik ditugaskan.', 'en-US': 'Mechanic assigned.' },
  'Mechanic replaced.': { 'id-ID': 'Mekanik diganti.', 'en-US': 'Mechanic replaced.' },
  'Work Order items': { 'id-ID': 'Item pekerjaan', 'en-US': 'Work Order items' },
  'No items selected yet.': { 'id-ID': 'Belum ada item yang dipilih.', 'en-US': 'No items selected yet.' },
  'Select items': { 'id-ID': 'Pilih item', 'en-US': 'Select items' },
  'Choose the services and spare parts for this Work Order.': { 'id-ID': 'Pilih layanan dan suku cadang untuk Work Order ini.', 'en-US': 'Choose the services and spare parts for this Work Order.' },
  'Spare part': { 'id-ID': 'Suku cadang', 'en-US': 'Spare part' },
  'Search services or spare parts': { 'id-ID': 'Cari layanan atau suku cadang', 'en-US': 'Search services or spare parts' },
  'Type': { 'id-ID': 'Jenis', 'en-US': 'Type' },
  'Selected items': { 'id-ID': 'Item dipilih', 'en-US': 'Selected items' },
  'Choose a service or spare part above.': { 'id-ID': 'Pilih layanan atau suku cadang di atas.', 'en-US': 'Choose a service or spare part above.' },
  'No variant': { 'id-ID': 'Tanpa varian', 'en-US': 'No variant' },
  'Starts from': { 'id-ID': 'Mulai dari', 'en-US': 'Starts from' },
  'Price not available': { 'id-ID': 'Harga belum tersedia', 'en-US': 'Price not available' },
  'Choose an additional item': { 'id-ID': 'Pilih item tambahan', 'en-US': 'Choose an additional item' },
  'This service needs one additional item.': { 'id-ID': 'Layanan ini perlu satu item tambahan.', 'en-US': 'This service needs one additional item.' },
  'Includes': { 'id-ID': 'Termasuk', 'en-US': 'Includes' },
  'Save items': { 'id-ID': 'Simpan item', 'en-US': 'Save items' },
  'Items saved.': { 'id-ID': 'Item tersimpan.', 'en-US': 'Items saved.' },
  'Could not load the catalog.': { 'id-ID': 'Katalog belum bisa dimuat.', 'en-US': 'Could not load the catalog.' },
  'Could not load Work Order items.': { 'id-ID': 'Item Work Order belum bisa dimuat.', 'en-US': 'Could not load Work Order items.' },
  'Could not load additional items.': { 'id-ID': 'Item tambahan belum bisa dimuat.', 'en-US': 'Could not load additional items.' },
  'No services or spare parts match your search.': { 'id-ID': 'Tidak ada layanan atau suku cadang yang cocok.', 'en-US': 'No services or spare parts match your search.' },
  'Prices are recorded when items are saved.': { 'id-ID': 'Harga dicatat saat item disimpan.', 'en-US': 'Prices are recorded when items are saved.' },
  'Billing summary': { 'id-ID': 'Ringkasan tagihan', 'en-US': 'Billing summary' },
  'Not charged': { 'id-ID': 'Tidak dikenakan', 'en-US': 'Not charged' },
  'Not validated': { 'id-ID': 'Belum divalidasi', 'en-US': 'Not validated' },
  'Validated': { 'id-ID': 'Tervalidasi', 'en-US': 'Validated' },
  'Needs revalidation': { 'id-ID': 'Perlu validasi ulang', 'en-US': 'Needs revalidation' },
  'Validate billing': { 'id-ID': 'Validasi tagihan', 'en-US': 'Validate billing' },
  'Revalidate billing': { 'id-ID': 'Validasi ulang', 'en-US': 'Revalidate billing' },
  'Items or tax settings changed after the billing was last validated.': { 'id-ID': 'Item atau pengaturan pajak berubah setelah tagihan terakhir divalidasi.', 'en-US': 'Items or tax settings changed after the billing was last validated.' },
  'Make sure the Work Order items and billing amounts are correct.': { 'id-ID': 'Pastikan item pekerjaan dan nilai tagihan sudah sesuai.', 'en-US': 'Make sure the Work Order items and billing amounts are correct.' },
  'Billing validated.': { 'id-ID': 'Tagihan tervalidasi.', 'en-US': 'Billing validated.' },
  'Could not load the billing summary.': { 'id-ID': 'Ringkasan tagihan belum bisa dimuat.', 'en-US': 'Could not load the billing summary.' },
  'Could not validate the billing. Try again.': { 'id-ID': 'Tagihan belum tervalidasi. Coba lagi.', 'en-US': 'Could not validate the billing. Try again.' },
  'The billing changed. Review the new amounts and try again.': { 'id-ID': 'Tagihan berubah. Periksa nilai terbaru lalu coba lagi.', 'en-US': 'The billing changed. Review the new amounts and try again.' },
  'Billing cannot be validated while the Work Order is in this status.': { 'id-ID': 'Tagihan belum bisa divalidasi pada status Work Order ini.', 'en-US': 'Billing cannot be validated while the Work Order is in this status.' },
  'This billing is already validated.': { 'id-ID': 'Tagihan ini sudah tervalidasi.', 'en-US': 'This billing is already validated.' },
  'The items use different currencies, so billing cannot be calculated.': { 'id-ID': 'Item memakai mata uang berbeda, sehingga tagihan tidak bisa dihitung.', 'en-US': 'The items use different currencies, so billing cannot be calculated.' },
  'Billing is not available yet. Reload the Work Order.': { 'id-ID': 'Tagihan belum tersedia. Muat ulang Work Order.', 'en-US': 'Billing is not available yet. Reload the Work Order.' },
  'You do not have permission to validate this billing.': { 'id-ID': 'Anda tidak punya izin memvalidasi tagihan ini.', 'en-US': 'You do not have permission to validate this billing.' },
  'Add item': { 'id-ID': 'Tambah item', 'en-US': 'Add item' },
  'Add to list': { 'id-ID': 'Tambahkan ke daftar', 'en-US': 'Add to list' },
  'Choose what to add to this Work Order.': { 'id-ID': 'Pilih yang akan ditambahkan ke Work Order ini.', 'en-US': 'Choose what to add to this Work Order.' },
  'Change items': { 'id-ID': 'Ubah item', 'en-US': 'Change items' },
  'Nothing is saved until you save the changes.': { 'id-ID': 'Perubahan baru tersimpan setelah Anda menyimpannya.', 'en-US': 'Nothing is saved until you save the changes.' },
  'Current items': { 'id-ID': 'Item saat ini', 'en-US': 'Current items' },
  'Items to add': { 'id-ID': 'Item yang ditambahkan', 'en-US': 'Items to add' },
  'No items on this Work Order.': { 'id-ID': 'Belum ada item pada Work Order ini.', 'en-US': 'No items on this Work Order.' },
  'No new items yet.': { 'id-ID': 'Belum ada item baru.', 'en-US': 'No new items yet.' },
  'Remove item': { 'id-ID': 'Hapus item', 'en-US': 'Remove item' },
  'Restore item': { 'id-ID': 'Batalkan hapus', 'en-US': 'Restore item' },
  'Will be removed': { 'id-ID': 'Akan dihapus', 'en-US': 'Will be removed' },
  'New': { 'id-ID': 'Baru', 'en-US': 'New' },
  'changes': { 'id-ID': 'perubahan', 'en-US': 'changes' },
  'Save changes': { 'id-ID': 'Simpan perubahan', 'en-US': 'Save changes' },
  'Items updated.': { 'id-ID': 'Item diperbarui.', 'en-US': 'Items updated.' },
  'Item change history': { 'id-ID': 'Riwayat perubahan item', 'en-US': 'Item change history' },
  'Added': { 'id-ID': 'Ditambahkan', 'en-US': 'Added' },
  'Removed': { 'id-ID': 'Dihapus', 'en-US': 'Removed' },
  'Quantity changed': { 'id-ID': 'Jumlah diubah', 'en-US': 'Quantity changed' },
  'Items can no longer be changed on this Work Order.': { 'id-ID': 'Item tidak bisa diubah lagi pada Work Order ini.', 'en-US': 'Items can no longer be changed on this Work Order.' },
  'One of the items was already changed. Open the Work Order again.': { 'id-ID': 'Salah satu item sudah berubah. Buka Work Order lagi.', 'en-US': 'One of the items was already changed. Open the Work Order again.' },
  'Enter a quantity above zero.': { 'id-ID': 'Isi jumlah lebih dari nol.', 'en-US': 'Enter a quantity above zero.' },
  'Could not save the items. Try again.': { 'id-ID': 'Item belum tersimpan. Coba lagi.', 'en-US': 'Could not save the items. Try again.' },
  'Items can only be selected before work starts on this Work Order.': { 'id-ID': 'Item hanya bisa dipilih sebelum pengerjaan dimulai.', 'en-US': 'Items can only be selected before work starts on this Work Order.' },
  'The items of this Work Order were already saved by someone else.': { 'id-ID': 'Item Work Order ini sudah disimpan oleh orang lain.', 'en-US': 'The items of this Work Order were already saved by someone else.' },
  'One of the items is no longer available. Reopen the list and choose again.': { 'id-ID': 'Salah satu item sudah tidak tersedia. Buka daftar lagi dan pilih ulang.', 'en-US': 'One of the items is no longer available. Reopen the list and choose again.' },
  'One of the variants is no longer available. Reopen the list and choose again.': { 'id-ID': 'Salah satu varian sudah tidak tersedia. Buka daftar lagi dan pilih ulang.', 'en-US': 'One of the variants is no longer available. Reopen the list and choose again.' },
  'One of the items cannot be selected on its own.': { 'id-ID': 'Salah satu item tidak bisa dipilih sendiri.', 'en-US': 'One of the items cannot be selected on its own.' },
  'One of the items has no price right now. Choose another item.': { 'id-ID': 'Salah satu item belum punya harga. Pilih item lain.', 'en-US': 'One of the items has no price right now. Choose another item.' },
  'Check the items, variants and quantities, then try again.': { 'id-ID': 'Periksa item, varian, dan jumlahnya, lalu coba lagi.', 'en-US': 'Check the items, variants and quantities, then try again.' },
  'Choose the additional item this service needs.': { 'id-ID': 'Pilih item tambahan yang dibutuhkan layanan ini.', 'en-US': 'Choose the additional item this service needs.' },
  'The additional item is no longer available.': { 'id-ID': 'Item tambahan sudah tidak tersedia.', 'en-US': 'The additional item is no longer available.' },
  'This item is already included in the service.': { 'id-ID': 'Item ini sudah termasuk dalam layanan.', 'en-US': 'This item is already included in the service.' },
  'Each additional item can be chosen only once.': { 'id-ID': 'Setiap item tambahan hanya bisa dipilih sekali.', 'en-US': 'Each additional item can be chosen only once.' },
  'A service cannot be its own additional item.': { 'id-ID': 'Layanan tidak bisa menjadi item tambahannya sendiri.', 'en-US': 'A service cannot be its own additional item.' },
  'An included part has no price right now. Choose another item.': { 'id-ID': 'Salah satu komponen belum punya harga. Pilih item lain.', 'en-US': 'An included part has no price right now. Choose another item.' },
  'You do not have permission to select items for this Work Order.': { 'id-ID': 'Anda tidak punya izin memilih item untuk Work Order ini.', 'en-US': 'You do not have permission to select items for this Work Order.' },
  'Search and add items': { 'id-ID': 'Cari & tambahkan item', 'en-US': 'Search and add items' },
  Selected: { 'id-ID': 'Dipilih', 'en-US': 'Selected' },
  'Work Order started.': { 'id-ID': 'Work Order dimulai.', 'en-US': 'Work Order started.' },
  'This mechanic is already working on another Work Order. Pause or finish it first.': {
    'id-ID': 'Mekanik ini sedang mengerjakan Work Order lain. Jeda atau selesaikan dulu.',
    'en-US': 'This mechanic is already working on another Work Order. Pause or finish it first.',
  },
  'This mechanic cannot take workshop work right now.': {
    'id-ID': 'Mekanik ini belum bisa menerima pekerjaan bengkel.',
    'en-US': 'This mechanic cannot take workshop work right now.',
  },
  'Assign a mechanic before starting this Work Order.': {
    'id-ID': 'Tugaskan mekanik sebelum memulai Work Order ini.',
    'en-US': 'Assign a mechanic before starting this Work Order.',
  },
  'The mechanic cannot be changed at this stage.': {
    'id-ID': 'Mekanik tidak bisa diganti pada tahap ini.',
    'en-US': 'The mechanic cannot be changed at this stage.',
  },
  'This mechanic already has this Work Order.': {
    'id-ID': 'Mekanik ini sudah ditugaskan di Work Order ini.',
    'en-US': 'This mechanic already has this Work Order.',
  },
  'The mechanic was not found.': {
    'id-ID': 'Mekanik tidak ditemukan.',
    'en-US': 'The mechanic was not found.',
  },
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
  ASSIGNED: { 'id-ID': 'Ditugaskan', 'en-US': 'Assigned' },
  AVAILABLE: { 'id-ID': 'Tersedia', 'en-US': 'Available' },
  BUSY: { 'id-ID': 'Sibuk', 'en-US': 'Busy' },
  INELIGIBLE: { 'id-ID': 'Tidak tersedia', 'en-US': 'Unavailable' },
  PAUSED: { 'id-ID': 'Dijeda', 'en-US': 'Paused' },
  DONE: { 'id-ID': 'Selesai', 'en-US': 'Done' },
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
  BACKOFFICE: { 'id-ID': 'Backoffice', 'en-US': 'Backoffice' },
  OPERATIONAL: { 'id-ID': 'Operational', 'en-US': 'Operational' },
  SYSTEM: { 'id-ID': 'Sistem', 'en-US': 'System' },
};

function humanizeTechnicalValue(value: string): string {
  return value
    .replace(/[:_]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function resolveOperationalLocale(locale: string | undefined): OperationalLocale {
  return locale === 'en-US' ? 'en-US' : 'id-ID';
}

export function operationalCopy(value: string, locale: OperationalLocale): string {
  return copy[value]?.[locale] ?? operationalPosCopy(value, locale) ?? value;
}

export function operationalLabel(value: string, locale: OperationalLocale): string {
  return technicalLabels[value]?.[locale] ?? humanizeTechnicalValue(value);
}

export function useOperationalLocalization() {
  const runtime = useRuntime();
  const locale = resolveOperationalLocale(runtime.locale);
  return {
    locale,
    copy: (value: string) => operationalCopy(value, locale),
    label: (value: string) => operationalLabel(value, locale),
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
