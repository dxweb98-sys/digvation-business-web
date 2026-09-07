import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type BackofficeLocale = 'id' | 'en';

const storageKey = 'digvation.pos.backoffice.locale.v1';

const messages = {
  id: {
    dashboard: 'Dasbor', masterData: 'Data Master', catalog: 'Katalog', employees: 'Karyawan',
    finance: 'Keuangan', financialAccounts: 'Akun Keuangan', expenses: 'Pengeluaran', reconciliation: 'Rekonsiliasi',
    reporting: 'Pelaporan', reports: 'Laporan', configuration: 'Konfigurasi', business: 'Bisnis', tax: 'Pajak',
    accessControl: 'Kontrol Akses', logout: 'Keluar', profile: 'Profil', changePassword: 'Ubah kata sandi',
    language: 'Bahasa', indonesian: 'Bahasa Indonesia', english: 'English', online: 'Online',
    authenticatedUser: 'Pengguna terautentikasi', openNavigation: 'Buka menu navigasi', notifications: 'Notifikasi',
    openAccountMenu: 'Buka menu akun', userAccount: 'Akun pengguna',
    signIn: 'Masuk', signInToBackoffice: 'Masuk ke Backoffice', usernameOrPhone: 'Nama pengguna atau nomor telepon',
    password: 'Kata sandi', signInFailed: 'Masuk gagal. Periksa kredensial ruang kerja Anda lalu coba lagi.',
    sessionExpired: 'Sesi Anda telah berakhir. Silakan masuk kembali.', signedOut: 'Anda telah keluar.',
    startupBlocked: 'Memulai aplikasi diblokir', startupFailed: 'Backoffice tidak dapat dimulai.', unknownStartupError: 'Kesalahan awal tidak diketahui',
    overview: 'Ringkasan', workspaceReady: 'Ruang kerja Backoffice Anda siap.',
    accessUnavailable: 'Akses tidak tersedia', accessUnavailableDescription: 'Peran Anda saat ini tidak memberikan akses ke area ini.', goToDashboard: 'Ke dasbor',
    notAvailableYet: 'Belum tersedia', notAvailableDescription: 'Area ini akan tersedia ketika kemampuan Backoffice terkait telah disediakan.',
    taxDescription: 'Pengaturan pajak akan tersedia di sini.', accountAndRuntime: 'Akun & runtime', version: 'Versi', build: 'Build',
  },
  en: {
    dashboard: 'Dashboard', masterData: 'Master Data', catalog: 'Catalog', employees: 'Employees',
    finance: 'Finance', financialAccounts: 'Financial Accounts', expenses: 'Expenses', reconciliation: 'Reconciliation',
    reporting: 'Reporting', reports: 'Reports', configuration: 'Configuration', business: 'Business', tax: 'Tax',
    accessControl: 'Access Control', logout: 'Logout', profile: 'Profile', changePassword: 'Change Password',
    language: 'Language', indonesian: 'Bahasa Indonesia', english: 'English', online: 'Online',
    authenticatedUser: 'Authenticated user', openNavigation: 'Open navigation menu', notifications: 'Notifications',
    openAccountMenu: 'Open account menu', userAccount: 'User account',
    signIn: 'Sign in', signInToBackoffice: 'Sign in to Backoffice', usernameOrPhone: 'Username or phone',
    password: 'Password', signInFailed: 'Sign-in failed. Check your workspace credentials and try again.',
    sessionExpired: 'Your session has expired. Please sign in again.', signedOut: 'You have signed out.',
    startupBlocked: 'Startup blocked', startupFailed: 'Backoffice could not initialize.', unknownStartupError: 'Unknown startup error',
    overview: 'Overview', workspaceReady: 'Your Backoffice workspace is ready.',
    accessUnavailable: 'Access unavailable', accessUnavailableDescription: 'Your current role does not grant access to this area.', goToDashboard: 'Go to dashboard',
    notAvailableYet: 'Not available yet', notAvailableDescription: 'This area will be available when its dedicated Backoffice capability is delivered.',
    taxDescription: 'Tax settings will be available here.', accountAndRuntime: 'Account & runtime', version: 'Version', build: 'Build',
  },
} as const;

const copy: Record<string, { id: string; en: string }> = {
  'Business profile': { id: 'Profil bisnis', en: 'Business profile' },
  'Configuration': { id: 'Konfigurasi', en: 'Configuration' },
  'Selling locations': { id: 'Lokasi penjualan', en: 'Selling locations' },
  'Edit profile': { id: 'Ubah profil', en: 'Edit profile' },
  'Not configured': { id: 'Belum dikonfigurasi', en: 'Not configured' },
  'Add location': { id: 'Tambah lokasi', en: 'Add location' },
  'No selling locations have been created yet.': { id: 'Belum ada lokasi penjualan yang dibuat.', en: 'No selling locations have been created yet.' },
  'Active': { id: 'Aktif', en: 'Active' }, 'Inactive': { id: 'Nonaktif', en: 'Inactive' },
  'Cancel': { id: 'Batal', en: 'Cancel' }, 'Save': { id: 'Simpan', en: 'Save' },
  'Previous': { id: 'Sebelumnya', en: 'Previous' }, 'Next': { id: 'Berikutnya', en: 'Next' },
  'Add selling location': { id: 'Tambah lokasi penjualan', en: 'Add selling location' },
  'Save location': { id: 'Simpan lokasi', en: 'Save location' },
  'Location code': { id: 'Kode lokasi', en: 'Location code' }, 'Location name': { id: 'Nama lokasi', en: 'Location name' },
  'Deactivate selling location?': { id: 'Nonaktifkan lokasi penjualan?', en: 'Deactivate selling location?' },
  'Deactivate': { id: 'Nonaktifkan', en: 'Deactivate' },
  'Access Control': { id: 'Kontrol Akses', en: 'Access Control' }, 'Create role': { id: 'Tambah peran', en: 'Create role' },
  'Roles': { id: 'Peran', en: 'Roles' }, 'Users': { id: 'Pengguna', en: 'Users' },
  'Role': { id: 'Peran', en: 'Role' }, 'Permissions': { id: 'Izin', en: 'Permissions' },
  'Status': { id: 'Status', en: 'Status' }, 'Code': { id: 'Kode', en: 'Code' }, 'Name': { id: 'Nama', en: 'Name' },
  'Manage role': { id: 'Kelola peran', en: 'Manage role' }, 'Manage roles': { id: 'Kelola peran', en: 'Manage roles' },
  'Deactivate role': { id: 'Nonaktifkan peran', en: 'Deactivate role' }, 'Deactivate role?': { id: 'Nonaktifkan peran?', en: 'Deactivate role?' },
  'Role code': { id: 'Kode peran', en: 'Role code' }, 'Role name': { id: 'Nama peran', en: 'Role name' },
  'Save role': { id: 'Simpan peran', en: 'Save role' }, 'Manage user roles': { id: 'Kelola peran pengguna', en: 'Manage user roles' },
  'Save assignments': { id: 'Simpan penetapan', en: 'Save assignments' }, 'Protected': { id: 'Dilindungi', en: 'Protected' },
  'Catalog': { id: 'Katalog', en: 'Catalog' }, 'Items': { id: 'Item', en: 'Items' }, 'Categories': { id: 'Kategori', en: 'Categories' },
  'Item': { id: 'Item', en: 'Item' }, 'Type': { id: 'Tipe', en: 'Type' }, 'Category': { id: 'Kategori', en: 'Category' },
  'Default Price': { id: 'Harga default', en: 'Default Price' }, 'Variants': { id: 'Varian', en: 'Variants' },
  'Set your business identity and manage the selling locations available to this workspace.': { id: 'Atur identitas bisnis dan kelola lokasi penjualan yang tersedia untuk ruang kerja ini.', en: 'Set your business identity and manage the selling locations available to this workspace.' },
  'The business name used by your POS records.': { id: 'Nama bisnis yang digunakan oleh catatan POS Anda.', en: 'The business name used by your POS records.' },
  'Selling locations are the branches used by POS transactions and location-specific pricing.': { id: 'Lokasi penjualan adalah cabang yang digunakan oleh transaksi POS dan harga khusus lokasi.', en: 'Selling locations are the branches used by POS transactions and location-specific pricing.' },
  'Edit selling location': { id: 'Ubah lokasi penjualan', en: 'Edit selling location' },
  'This location will remain in historical records but cannot be used as an active selling location.': { id: 'Lokasi ini tetap ada dalam catatan historis, tetapi tidak dapat digunakan sebagai lokasi penjualan aktif.', en: 'This location will remain in historical records but cannot be used as an active selling location.' },
  'Set the name that identifies this business in POS records.': { id: 'Atur nama yang mengidentifikasi bisnis ini dalam catatan POS.', en: 'Set the name that identifies this business in POS records.' },
  'Save profile': { id: 'Simpan profil', en: 'Save profile' }, 'Business name': { id: 'Nama bisnis', en: 'Business name' },
  'A selling location is the branch context for POS sales and location-specific prices.': { id: 'Lokasi penjualan adalah konteks cabang untuk penjualan POS dan harga khusus lokasi.', en: 'A selling location is the branch context for POS sales and location-specific prices.' },
  'Location codes are permanent once created.': { id: 'Kode lokasi bersifat permanen setelah dibuat.', en: 'Location codes are permanent once created.' },
  'Showing': { id: 'Menampilkan', en: 'Showing' },
  'Manage items and categories.': { id: 'Kelola item dan kategori.', en: 'Manage items and categories.' },
  'Search item name or code...': { id: 'Cari nama atau kode item...', en: 'Search item name or code...' },
  'Search category name or code...': { id: 'Cari nama atau kode kategori...', en: 'Search category name or code...' },
  'Add item': { id: 'Tambah item', en: 'Add item' }, 'Add category': { id: 'Tambah kategori', en: 'Add category' },
  'View details': { id: 'Lihat detail', en: 'View details' }, 'Edit item': { id: 'Ubah item', en: 'Edit item' }, 'Edit category': { id: 'Ubah kategori', en: 'Edit category' },
  'No matching items found.': { id: 'Tidak ada item yang sesuai.', en: 'No matching items found.' }, 'No catalog items are available.': { id: 'Belum ada item katalog.', en: 'No catalog items are available.' },
  'No matching categories found.': { id: 'Tidak ada kategori yang sesuai.', en: 'No matching categories found.' }, 'No catalog categories are available.': { id: 'Belum ada kategori katalog.', en: 'No catalog categories are available.' },
  'Close': { id: 'Tutup', en: 'Close' }, 'Price': { id: 'Harga', en: 'Price' }, 'Manage variant price': { id: 'Kelola harga varian', en: 'Manage variant price' },
  'Add': { id: 'Tambah', en: 'Add' }, 'Edit': { id: 'Ubah', en: 'Edit' }, 'Variant': { id: 'Varian', en: 'Variant' },
  'Product': { id: 'Produk', en: 'Product' }, 'Service': { id: 'Layanan', en: 'Service' }, 'Draft': { id: 'Draf', en: 'Draft' }, 'Cancelled': { id: 'Dibatalkan', en: 'Cancelled' },
  'Manage tenant roles and user role assignments. Permissions are defined by the POS platform.': { id: 'Kelola peran tenant dan penetapan peran pengguna. Izin ditentukan oleh platform POS.', en: 'Manage tenant roles and user role assignments. Permissions are defined by the POS platform.' },
  'Users will no longer receive this role\'s permissions.': { id: 'Pengguna tidak lagi menerima izin dari peran ini.', en: 'Users will no longer receive this role\'s permissions.' },
  'System role': { id: 'Peran sistem', en: 'System role' }, 'No roles are available for this workspace.': { id: 'Tidak ada peran untuk ruang kerja ini.', en: 'No roles are available for this workspace.' },
  'User': { id: 'Pengguna', en: 'User' }, 'Username': { id: 'Nama pengguna', en: 'Username' }, 'No username': { id: 'Tidak ada nama pengguna', en: 'No username' },
  'No roles assigned': { id: 'Belum ada peran', en: 'No roles assigned' }, 'No POS users are available for this workspace.': { id: 'Tidak ada pengguna POS untuk ruang kerja ini.', en: 'No POS users are available for this workspace.' },
  'System roles are protected by the POS authorization policy.': { id: 'Peran sistem dilindungi oleh kebijakan otorisasi POS.', en: 'System roles are protected by the POS authorization policy.' },
  'Role permissions are assigned from the platform permission registry.': { id: 'Izin peran ditetapkan dari registri izin platform.', en: 'Role permissions are assigned from the platform permission registry.' },
  'Not assigned': { id: 'Belum ditetapkan', en: 'Not assigned' }, 'Description': { id: 'Deskripsi', en: 'Description' }, 'No description': { id: 'Tidak ada deskripsi', en: 'No description' },
  'Fulfillment': { id: 'Pemenuhan', en: 'Fulfillment' }, 'Service configuration': { id: 'Konfigurasi layanan', en: 'Service configuration' },
  'Default duration': { id: 'Durasi default', en: 'Default duration' },
  'Employee assignment': { id: 'Penugasan karyawan', en: 'Employee assignment' }, 'Employee contribution': { id: 'Kontribusi karyawan', en: 'Employee contribution' },
  'Allowed': { id: 'Diizinkan', en: 'Allowed' }, 'Not allowed': { id: 'Tidak diizinkan', en: 'Not allowed' },
  'Price history': { id: 'Riwayat harga', en: 'Price history' }, 'Set price': { id: 'Atur harga', en: 'Set price' }, 'Change price': { id: 'Ubah harga', en: 'Change price' },
  'Manage variants for this item.': { id: 'Kelola varian untuk item ini.', en: 'Manage variants for this item.' }, 'Add variant': { id: 'Tambah varian', en: 'Add variant' },
  'No variants.': { id: 'Belum ada varian.', en: 'No variants.' }, 'Edit variant': { id: 'Ubah varian', en: 'Edit variant' },
  'Loading...': { id: 'Memuat...', en: 'Loading...' }, 'Not set': { id: 'Belum diatur', en: 'Not set' }, 'Uses default price': { id: 'Menggunakan harga default', en: 'Uses default price' },
  'Effective from': { id: 'Berlaku mulai', en: 'Effective from' }, 'Effective until': { id: 'Berlaku sampai', en: 'Effective until' }, 'Cancel price': { id: 'Batalkan harga', en: 'Cancel price' },
  'Basic information': { id: 'Informasi dasar', en: 'Basic information' }, 'No default price history.': { id: 'Belum ada riwayat harga default.', en: 'No default price history.' },
  'Cancel price?': { id: 'Batalkan harga?', en: 'Cancel price?' }, 'Price history is retained, but this price no longer applies.': { id: 'Riwayat harga tetap tersimpan, tetapi harga ini tidak lagi berlaku.', en: 'Price history is retained, but this price no longer applies.' },
  'Variant price': { id: 'Harga varian', en: 'Variant price' }, 'Change default price': { id: 'Ubah harga default', en: 'Change default price' }, 'Save price': { id: 'Simpan harga', en: 'Save price' }, 'New price': { id: 'Harga baru', en: 'New price' },
  'Price updated.': { id: 'Harga berhasil diperbarui.', en: 'Price updated.' }, 'Price cancelled.': { id: 'Harga berhasil dibatalkan.', en: 'Price cancelled.' },
  'Could not update price.': { id: 'Gagal memperbarui harga.', en: 'Could not update price.' }, 'Could not cancel price.': { id: 'Gagal membatalkan harga.', en: 'Could not cancel price.' },
  'Currency:': { id: 'Mata uang:', en: 'Currency:' }, 'No variant-specific price history.': { id: 'Belum ada harga khusus untuk varian ini.', en: 'No variant-specific price history.' },
  'Effective now': { id: 'Berlaku sekarang', en: 'Effective now' }, 'Variant prices are final prices, not differences from the default price.': { id: 'Harga varian adalah harga final, bukan selisih dari harga default.', en: 'Variant prices are final prices, not differences from the default price.' },
  'Item added.': { id: 'Item berhasil ditambahkan.', en: 'Item added.' }, 'Item updated.': { id: 'Item berhasil diperbarui.', en: 'Item updated.' }, 'Could not save item.': { id: 'Gagal menyimpan item.', en: 'Could not save item.' },
  'Item code': { id: 'Kode item', en: 'Item code' }, 'Item name': { id: 'Nama item', en: 'Item name' }, 'Optional, in minutes.': { id: 'Opsional, dalam menit.', en: 'Optional, in minutes.' }, 'Allow employee contribution': { id: 'Izinkan kontribusi karyawan', en: 'Allow employee contribution' },
  'Leave blank to generate a code automatically.': { id: 'Kosongkan untuk membuat kode otomatis.', en: 'Leave blank to generate a code automatically.' }, 'Code cannot be changed after creation.': { id: 'Kode tidak dapat diubah setelah dibuat.', en: 'Code cannot be changed after creation.' },
  'Item code and type cannot be changed after creation.': { id: 'Kode dan tipe item tidak dapat diubah setelah dibuat.', en: 'Item code and type cannot be changed after creation.' }, 'Item code and type cannot be changed.': { id: 'Kode dan tipe item tidak dapat diubah.', en: 'Item code and type cannot be changed.' },
  'Instant': { id: 'Instan', en: 'Instant' }, 'Tracked': { id: 'Terlacak', en: 'Tracked' }, 'None': { id: 'Tidak ada', en: 'None' }, 'Optional': { id: 'Opsional', en: 'Optional' }, 'Required': { id: 'Wajib', en: 'Required' }, 'Default duration must be a positive whole number.': { id: 'Durasi default harus berupa bilangan bulat positif.', en: 'Default duration must be a positive whole number.' },
  'Category added.': { id: 'Kategori berhasil ditambahkan.', en: 'Category added.' }, 'Category updated.': { id: 'Kategori berhasil diperbarui.', en: 'Category updated.' }, 'Could not save category.': { id: 'Gagal menyimpan kategori.', en: 'Could not save category.' },
  'Operations': { id: 'Operasional', en: 'Operations' }, 'Backoffice foundation': { id: 'Fondasi Backoffice', en: 'Backoffice foundation' }, 'Branches': { id: 'Cabang', en: 'Branches' }, 'Pricing & Tax': { id: 'Harga & Pajak', en: 'Pricing & Tax' },
  'No fake dashboard metrics are shown. Management capabilities appear only when their backend contract and frontend checkpoint are approved.': { id: 'Tidak ada metrik dasbor palsu yang ditampilkan. Kemampuan pengelolaan hanya muncul setelah kontrak backend dan checkpoint frontend disetujui.', en: 'No fake dashboard metrics are shown. Management capabilities appear only when their backend contract and frontend checkpoint are approved.' },
  'Business profile updated.': { id: 'Profil bisnis berhasil diperbarui.', en: 'Business profile updated.' }, 'Could not update business profile.': { id: 'Gagal memperbarui profil bisnis.', en: 'Could not update business profile.' },
  'Selling location added.': { id: 'Lokasi penjualan berhasil ditambahkan.', en: 'Selling location added.' }, 'Selling location updated.': { id: 'Lokasi penjualan berhasil diperbarui.', en: 'Selling location updated.' }, 'Selling location deactivated.': { id: 'Lokasi penjualan berhasil dinonaktifkan.', en: 'Selling location deactivated.' }, 'Could not save selling location.': { id: 'Gagal menyimpan lokasi penjualan.', en: 'Could not save selling location.' },
  'Role added.': { id: 'Peran berhasil ditambahkan.', en: 'Role added.' }, 'Role updated.': { id: 'Perubahan peran berhasil disimpan.', en: 'Role updated.' }, 'Role deactivated.': { id: 'Peran berhasil dinonaktifkan.', en: 'Role deactivated.' }, 'Could not save role.': { id: 'Gagal menyimpan peran.', en: 'Could not save role.' }, 'Could not deactivate role.': { id: 'Gagal menonaktifkan peran.', en: 'Could not deactivate role.' }, 'User roles updated.': { id: 'Peran pengguna berhasil diperbarui.', en: 'User roles updated.' }, 'Could not update user roles.': { id: 'Gagal memperbarui peran pengguna.', en: 'Could not update user roles.' },
  'A new price is added to effective history; the previous price is unchanged.': { id: 'Harga baru ditambahkan ke riwayat efektif; harga sebelumnya tidak diubah.', en: 'A new price is added to effective history; the previous price is unchanged.' },
  'Only variant-specific prices are recorded here. The item default price is not variant history.': { id: 'Hanya harga khusus varian yang dicatat di sini. Harga default item bukan riwayat varian.', en: 'Only variant-specific prices are recorded here. The item default price is not variant history.' },
  'Enter your username or phone number': { id: 'Masukkan nama pengguna atau nomor telepon', en: 'Enter your username or phone number' },
  'Enter your password': { id: 'Masukkan kata sandi Anda', en: 'Enter your password' },
  'Master Data': { id: 'Data Master', en: 'Master Data' }, 'Employees': { id: 'Karyawan', en: 'Employees' }, 'Manage employees available to POS operations.': { id: 'Kelola karyawan yang tersedia untuk operasional POS.', en: 'Manage employees available to POS operations.' },
  'Display name': { id: 'Nama tampilan', en: 'Display name' }, 'Updated': { id: 'Diperbarui', en: 'Updated' }, 'Created': { id: 'Dibuat', en: 'Created' }, 'All': { id: 'Semua', en: 'All' },
  'Search employee code or name...': { id: 'Cari kode atau nama karyawan...', en: 'Search employee code or name...' }, 'Add employee': { id: 'Tambah karyawan', en: 'Add employee' }, 'Edit employee': { id: 'Ubah karyawan', en: 'Edit employee' }, 'Employee code': { id: 'Kode karyawan', en: 'Employee code' }, 'Employee details': { id: 'Detail karyawan', en: 'Employee details' },
  'No matching employees found.': { id: 'Tidak ada karyawan yang sesuai.', en: 'No matching employees found.' }, 'No employees are available.': { id: 'Belum ada karyawan.', en: 'No employees are available.' }, 'Deactivate employee': { id: 'Nonaktifkan karyawan', en: 'Deactivate employee' }, 'Activate employee': { id: 'Aktifkan karyawan', en: 'Activate employee' },
  'Deactivate employee?': { id: 'Nonaktifkan karyawan?', en: 'Deactivate employee?' }, 'Activate employee?': { id: 'Aktifkan karyawan?', en: 'Activate employee?' },
  'This employee remains in historical records but cannot be selected for new POS assignments.': { id: 'Karyawan ini tetap ada dalam catatan historis, tetapi tidak dapat dipilih untuk penugasan POS baru.', en: 'This employee remains in historical records but cannot be selected for new POS assignments.' }, 'This employee can be selected for POS assignments again.': { id: 'Karyawan ini dapat dipilih untuk penugasan POS kembali.', en: 'This employee can be selected for POS assignments again.' },
  'Employees are created Active.': { id: 'Karyawan baru dibuat Aktif.', en: 'Employees are created Active.' }, 'Employee code cannot be changed after creation.': { id: 'Kode karyawan tidak dapat diubah setelah dibuat.', en: 'Employee code cannot be changed after creation.' }, 'Employee added.': { id: 'Karyawan berhasil ditambahkan.', en: 'Employee added.' }, 'Employee updated.': { id: 'Karyawan berhasil diperbarui.', en: 'Employee updated.' },
  'Could not save employee.': { id: 'Gagal menyimpan karyawan.', en: 'Could not save employee.' }, 'Employee data changed. The latest data has been loaded; review it before trying again.': { id: 'Data karyawan telah berubah. Data terbaru telah dimuat; tinjau sebelum mencoba lagi.', en: 'Employee data changed. The latest data has been loaded; review it before trying again.' }, 'For example, Ari Pratama': { id: 'Contoh, Ari Pratama', en: 'For example, Ari Pratama' },
  'Join date': { id: 'Tanggal bergabung', en: 'Join date' }, 'Select join date': { id: 'Pilih tanggal bergabung', en: 'Select join date' },
  'Leave Employee Code blank to generate it automatically.': { id: 'Kosongkan Kode Karyawan untuk membuatnya secara otomatis.', en: 'Leave Employee Code blank to generate it automatically.' },
  'Employee Information': { id: 'Informasi karyawan', en: 'Employee Information' }, 'System Information': { id: 'Informasi sistem', en: 'System Information' },
  'Reactivate employee?': { id: 'Aktifkan kembali karyawan?', en: 'Reactivate employee?' }, 'Reactivate': { id: 'Aktifkan kembali', en: 'Reactivate' },
  'Reason': { id: 'Alasan', en: 'Reason' }, 'Reason is optional and will be recorded in employee history.': { id: 'Alasan bersifat opsional dan akan dicatat dalam riwayat karyawan.', en: 'Reason is optional and will be recorded in employee history.' },
  'Optional reason for this status change': { id: 'Alasan opsional untuk perubahan status ini', en: 'Optional reason for this status change' },
  'Employee deactivated.': { id: 'Karyawan berhasil dinonaktifkan.', en: 'Employee deactivated.' }, 'Employee reactivated.': { id: 'Karyawan berhasil diaktifkan kembali.', en: 'Employee reactivated.' },
  'Employee History': { id: 'Riwayat Karyawan', en: 'Employee History' }, 'Event': { id: 'Peristiwa', en: 'Event' }, 'Date / Time': { id: 'Tanggal / Waktu', en: 'Date / Time' },
  'Changed by': { id: 'Diubah oleh', en: 'Changed by' }, 'Joined': { id: 'Bergabung', en: 'Joined' }, 'Deactivated': { id: 'Dinonaktifkan', en: 'Deactivated' }, 'Reactivated': { id: 'Diaktifkan kembali', en: 'Reactivated' },
  'No employee history is available.': { id: 'Belum ada riwayat karyawan.', en: 'No employee history is available.' },
  'Could not load employee details.': { id: 'Detail karyawan tidak dapat dimuat.', en: 'Could not load employee details.' },
  'Tenure': { id: 'Masa kerja', en: 'Tenure' }, 'Current status': { id: 'Status saat ini', en: 'Current status' },
  'year': { id: 'tahun', en: 'year' }, 'years': { id: 'tahun', en: 'years' }, 'month': { id: 'bulan', en: 'month' }, 'months': { id: 'bulan', en: 'months' }, 'day': { id: 'hari', en: 'day' }, 'days': { id: 'hari', en: 'days' }, 'Machine': { id: 'Mesin', en: 'Machine' },
  'For example, Main Store': { id: 'Contoh, Toko Utama', en: 'For example, Main Store' },
  'For example, Central Jakarta': { id: 'Contoh, Jakarta Pusat', en: 'For example, Central Jakarta' },
  'For example, Store Manager': { id: 'Contoh, Manajer Toko', en: 'For example, Store Manager' },
  'For example, Coffee Latte': { id: 'Contoh, Kopi Latte', en: 'For example, Coffee Latte' },
  'Add an optional description for this item': { id: 'Tambahkan deskripsi opsional untuk item ini', en: 'Add an optional description for this item' },
  'For example, 100000': { id: 'Contoh, 100000', en: 'For example, 100000' },
  'Select the date the price takes effect': { id: 'Pilih tanggal mulai berlaku harga', en: 'Select the date the price takes effect' },
};

export type BackofficeMessageKey = keyof (typeof messages)['id'];

interface BackofficeLocalizationValue {
  locale: BackofficeLocale;
  setLocale: (locale: BackofficeLocale) => void;
  t: (key: BackofficeMessageKey) => string;
  copy: (value: string) => string;
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatMoney: (amount: string, currency: string) => string;
}

const BackofficeLocalizationContext = createContext<BackofficeLocalizationValue | null>(null);

export function readStoredBackofficeLocale(): BackofficeLocale {
  if (typeof window === 'undefined') return 'id';
  return window.localStorage.getItem(storageKey) === 'en' ? 'en' : 'id';
}

export function BackofficeLocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrentLocale] = useState<BackofficeLocale>(readStoredBackofficeLocale);
  const setLocale = useCallback((nextLocale: BackofficeLocale) => {
    window.localStorage.setItem(storageKey, nextLocale);
    setCurrentLocale(nextLocale);
  }, []);
  const value = useMemo<BackofficeLocalizationValue>(() => ({
    locale,
    setLocale,
    t: (key) => messages[locale][key],
    copy: (value) => copy[value]?.[locale] ?? value,
    formatDate: (value, options) => new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', options).format(value),
    formatMoney: (amount, currency) => new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount)),
  }), [locale, setLocale]);
  return <BackofficeLocalizationContext.Provider value={value}>{children}</BackofficeLocalizationContext.Provider>;
}

export function useBackofficeLocalization(): BackofficeLocalizationValue {
  const context = useContext(BackofficeLocalizationContext);
  if (!context) throw new Error('BackofficeLocalizationProvider is missing.');
  return context;
}
