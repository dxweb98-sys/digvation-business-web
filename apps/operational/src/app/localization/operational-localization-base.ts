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
