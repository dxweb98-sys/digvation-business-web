export type HumanLabelLocale = 'id' | 'en';

type LocalizedLabel = Record<HumanLabelLocale, string>;

const technicalLabels: Record<string, LocalizedLabel> = {
  ACTIVE: { id: 'Aktif', en: 'Active' },
  INACTIVE: { id: 'Nonaktif', en: 'Inactive' },
  DISABLED: { id: 'Dinonaktifkan', en: 'Disabled' },
  PENDING_ACTIVATION: { id: 'Menunggu aktivasi', en: 'Pending activation' },
  DRAFT: { id: 'Draf', en: 'Draft' },
  OPEN: { id: 'Berjalan', en: 'Open' },
  FINALIZED: { id: 'Selesai', en: 'Completed' },
  VOIDED: { id: 'Dibatalkan', en: 'Voided' },
  QUEUED: { id: 'Antrian', en: 'Queued' },
  IN_PROGRESS: { id: 'Dikerjakan', en: 'In progress' },
  COMPLETED: { id: 'Selesai', en: 'Completed' },
  CANCELED: { id: 'Dibatalkan', en: 'Canceled' },
  CANCELLED: { id: 'Dibatalkan', en: 'Cancelled' },
  PENDING: { id: 'Menunggu', en: 'Pending' },
  WAITING: { id: 'Menunggu', en: 'Waiting' },
  SUCCEEDED: { id: 'Berhasil', en: 'Succeeded' },
  FAILED: { id: 'Gagal', en: 'Failed' },
  REJECTED: { id: 'Ditolak', en: 'Rejected' },
  APPROVED: { id: 'Disetujui', en: 'Approved' },
  EXPIRED: { id: 'Kedaluwarsa', en: 'Expired' },
  ACCEPTED: { id: 'Diterima', en: 'Accepted' },
  REVOKED: { id: 'Dicabut', en: 'Revoked' },
  RESOLVED: { id: 'Selesai ditangani', en: 'Resolved' },
  DISCREPANCY: { id: 'Ada selisih', en: 'Discrepancy' },
  PRODUCT: { id: 'Produk', en: 'Product' },
  SERVICE: { id: 'Layanan', en: 'Service' },
  REQUIRED: { id: 'Wajib', en: 'Required' },
  OPTIONAL: { id: 'Opsional', en: 'Optional' },
  NONE: { id: 'Tidak diperlukan', en: 'Not required' },
  EXACT: { id: 'Harga tetap', en: 'Fixed price' },
  FROM: { id: 'Mulai dari', en: 'From' },
  TRACKED: { id: 'Perlu pengerjaan', en: 'Work tracked' },
  INSTANT: { id: 'Langsung selesai', en: 'Instant' },
  CASH: { id: 'Tunai', en: 'Cash' },
  BANK_TRANSFER: { id: 'Transfer bank', en: 'Bank transfer' },
  WALLET: { id: 'Dompet digital', en: 'E-wallet' },
  QRIS: { id: 'QRIS', en: 'QRIS' },
  CASH_IN: { id: 'Kas masuk', en: 'Cash in' },
  CASH_OUT: { id: 'Kas keluar', en: 'Cash out' },
  PARTIALLY_PAID: { id: 'Dibayar sebagian', en: 'Partially paid' },
  PAID: { id: 'Lunas', en: 'Paid' },
  UNPAID: { id: 'Belum dibayar', en: 'Unpaid' },
  MATCHED: { id: 'Sesuai', en: 'Matched' },
  ARCHIVED: { id: 'Diarsipkan', en: 'Archived' },
  PRESENT: { id: 'Hadir', en: 'Present' },
  ABSENT: { id: 'Tidak hadir', en: 'Absent' },
  LEAVE: { id: 'Izin', en: 'Leave' },
  SICK: { id: 'Sakit', en: 'Sick' },
  LOCAL: { id: 'Lokal', en: 'Local' },
  HRIS: { id: 'HRIS', en: 'HRIS' },
  BACKOFFICE: { id: 'Backoffice', en: 'Backoffice' },
  OPERATIONAL: { id: 'Operational', en: 'Operational' },
  CASHIER: { id: 'Kasir', en: 'Cashier' },
  INCLUDED: { id: 'Termasuk harga', en: 'Included in price' },
  EXCLUDED: { id: 'Di luar harga', en: 'Excluded from price' },
};

const eventLabels: Record<string, LocalizedLabel> = {
  LOGIN_SUCCEEDED: { id: 'Berhasil masuk', en: 'Login succeeded' },
  LOGOUT: { id: 'Keluar dari akun', en: 'Logged out' },
  BUSINESS_NUMBERING_UPDATED: {
    id: 'Pengaturan penomoran diperbarui',
    en: 'Numbering settings updated',
  },
  EXPENSE_APPROVED: { id: 'Pengeluaran disetujui', en: 'Expense approved' },
  EXPENSE_REJECTED: { id: 'Pengeluaran ditolak', en: 'Expense rejected' },
  EXPENSE_CREATED: { id: 'Pengeluaran dibuat', en: 'Expense created' },
  EXPENSE_UPDATED: { id: 'Pengeluaran diperbarui', en: 'Expense updated' },
  BUSINESS_PROFILE_UPDATED: { id: 'Profil bisnis diperbarui', en: 'Business profile updated' },
  BUSINESS_LOCALIZATION_UPDATED: {
    id: 'Pengaturan regional diperbarui',
    en: 'Localization settings updated',
  },
  LOCATION_CREATED: { id: 'Lokasi dibuat', en: 'Location created' },
  LOCATION_UPDATED: { id: 'Lokasi diperbarui', en: 'Location updated' },
  CATALOG_CATEGORY_CREATED: { id: 'Kategori katalog dibuat', en: 'Catalog category created' },
  CATALOG_CATEGORY_UPDATED: { id: 'Kategori katalog diperbarui', en: 'Catalog category updated' },
  CATALOG_ITEM_CREATED: { id: 'Item katalog dibuat', en: 'Catalog item created' },
  CATALOG_ITEM_UPDATED: { id: 'Item katalog diperbarui', en: 'Catalog item updated' },
  CATALOG_VARIANT_CREATED: { id: 'Varian katalog dibuat', en: 'Catalog variant created' },
  CATALOG_VARIANT_UPDATED: { id: 'Varian katalog diperbarui', en: 'Catalog variant updated' },
  TAX_PROFILE_UPDATED: { id: 'Pengaturan pajak diperbarui', en: 'Tax profile updated' },
  TAX_RULE_CREATED: { id: 'Aturan pajak dibuat', en: 'Tax rule created' },
  TAX_RULE_CANCELLED: { id: 'Aturan pajak dibatalkan', en: 'Tax rule cancelled' },
  TAX_CATEGORY_CREATED: { id: 'Kategori pajak dibuat', en: 'Tax category created' },
  TAX_CATEGORY_UPDATED: { id: 'Kategori pajak diperbarui', en: 'Tax category updated' },
  PRICE_CREATED: { id: 'Harga dibuat', en: 'Price created' },
  PRICE_CHANGED: { id: 'Harga diperbarui', en: 'Price changed' },
  PRICE_CANCELLED: { id: 'Harga dibatalkan', en: 'Price cancelled' },
  EMPLOYEE_POSITION_CREATED: { id: 'Jabatan karyawan dibuat', en: 'Employee position created' },
  EMPLOYEE_POSITION_UPDATED: { id: 'Jabatan karyawan diperbarui', en: 'Employee position updated' },
  ATTENDANCE_UPDATED: { id: 'Absensi diperbarui', en: 'Attendance updated' },
  EMPLOYEE_CREATED: { id: 'Karyawan dibuat', en: 'Employee created' },
  EMPLOYEE_UPDATED: { id: 'Karyawan diperbarui', en: 'Employee updated' },
  FINANCIAL_ACCOUNT_CREATED: { id: 'Akun keuangan ditambahkan', en: 'Financial account added' },
  FINANCIAL_ACCOUNT_UPDATED: { id: 'Akun keuangan diperbarui', en: 'Financial account updated' },
  PAYMENT_ROUTE_CREATED: { id: 'Rute pembayaran ditambahkan', en: 'Payment route added' },
  PAYMENT_ROUTE_UPDATED: { id: 'Rute pembayaran diperbarui', en: 'Payment route updated' },
  CASH_MOVEMENT_CREATED: { id: 'Pergerakan kas dicatat', en: 'Cash movement recorded' },
  SETTLEMENT_CREATED: { id: 'Penyelesaian dana dibuat', en: 'Settlement created' },
  SETTLEMENT_COMPLETED: { id: 'Penyelesaian dana selesai', en: 'Settlement completed' },
  SETTLEMENT_CANCELLED: { id: 'Penyelesaian dana dibatalkan', en: 'Settlement cancelled' },
  RECONCILIATION_CREATED: { id: 'Rekonsiliasi dicatat', en: 'Reconciliation recorded' },
  RECONCILIATION_UPDATED: { id: 'Rekonsiliasi diperbarui', en: 'Reconciliation updated' },
  SALE_CREATED: { id: 'Transaksi dibuat', en: 'Transaction created' },
  SALE_LINE_ADDED: { id: 'Item transaksi ditambahkan', en: 'Transaction item added' },
  SALE_LINE_QUANTITY_CHANGED: {
    id: 'Jumlah item transaksi diubah',
    en: 'Transaction item quantity changed',
  },
  SALE_LINE_REMOVED: { id: 'Item transaksi dihapus', en: 'Transaction item removed' },
  SALE_LINE_PRICE_OVERRIDDEN: {
    id: 'Harga item transaksi diubah',
    en: 'Transaction item price changed',
  },
  SALE_LINE_PRICE_OVERRIDE_REMOVED: {
    id: 'Perubahan harga item dibatalkan',
    en: 'Transaction item price override removed',
  },
  SALE_LINE_DISCOUNT_APPLIED: {
    id: 'Diskon item transaksi diterapkan',
    en: 'Transaction item discount applied',
  },
  SALE_LINE_DISCOUNT_REMOVED: {
    id: 'Diskon item transaksi dihapus',
    en: 'Transaction item discount removed',
  },
  SALE_DISCOUNT_APPLIED: { id: 'Diskon transaksi diterapkan', en: 'Transaction discount applied' },
  SALE_DISCOUNT_REMOVED: { id: 'Diskon transaksi dihapus', en: 'Transaction discount removed' },
  SALE_LINE_ASSIGNMENTS_CHANGED: {
    id: 'Penugasan item transaksi diubah',
    en: 'Transaction item assignment changed',
  },
  SALE_LINE_CONTRIBUTIONS_CHANGED: {
    id: 'Kontribusi item transaksi diubah',
    en: 'Transaction item contribution changed',
  },
  SALE_FINALIZED: { id: 'Transaksi diselesaikan', en: 'Transaction completed' },
  SALE_VOIDED: { id: 'Transaksi dibatalkan', en: 'Transaction voided' },
  SALE_WORK_STARTED: { id: 'Pengerjaan dimulai', en: 'Work started' },
  PAYMENT_CREATED: { id: 'Pembayaran dibuat', en: 'Payment created' },
  PAYMENT_SUCCEEDED: { id: 'Pembayaran berhasil', en: 'Payment succeeded' },
  PAYMENT_FAILED: { id: 'Pembayaran gagal', en: 'Payment failed' },
  PAYMENT_CANCELLED: { id: 'Pembayaran dibatalkan', en: 'Payment cancelled' },
  PAYMENT_EXPIRED: { id: 'Pembayaran kedaluwarsa', en: 'Payment expired' },
  FULFILLMENT_STARTED: { id: 'Pengerjaan dimulai', en: 'Work started' },
  FULFILLMENT_COMPLETED: { id: 'Pengerjaan selesai', en: 'Work completed' },
  FULFILLMENT_CANCELLED: { id: 'Pengerjaan dibatalkan', en: 'Work cancelled' },
  OWNER_PROVISIONED: { id: 'Akun pemilik disiapkan', en: 'Owner account provisioned' },
  OWNER_GRANTED: { id: 'Peran pemilik diberikan', en: 'Owner role granted' },
  OWNER_REVOKED: { id: 'Peran pemilik dicabut', en: 'Owner role revoked' },
  INVITATION_CREATED: { id: 'Undangan pengguna dibuat', en: 'User invitation created' },
  INVITATION_RESENT: { id: 'Undangan pengguna dikirim ulang', en: 'User invitation resent' },
  INVITATION_REVOKED: { id: 'Undangan pengguna dicabut', en: 'User invitation revoked' },
  INVITATION_ACCEPTED: { id: 'Undangan pengguna diterima', en: 'User invitation accepted' },
  USER_UPDATED: { id: 'Pengguna diperbarui', en: 'User updated' },
  USER_ENABLED: { id: 'Pengguna diaktifkan', en: 'User enabled' },
  USER_DISABLED: { id: 'Pengguna dinonaktifkan', en: 'User disabled' },
  USER_ROLES_CHANGED: { id: 'Peran pengguna diperbarui', en: 'User roles changed' },
  ROLE_CREATED: { id: 'Peran dibuat', en: 'Role created' },
  ROLE_UPDATED: { id: 'Peran diperbarui', en: 'Role updated' },
  ROLE_STATUS_CHANGED: { id: 'Status peran diperbarui', en: 'Role status changed' },
  ROLE_PERMISSIONS_CHANGED: { id: 'Izin peran diperbarui', en: 'Role permissions changed' },
  USER_SESSIONS_REVOKED: { id: 'Sesi pengguna dicabut', en: 'User sessions revoked' },
  PASSWORD_CHANGED: { id: 'Kata sandi diubah', en: 'Password changed' },
  PASSWORD_RESET_COMPLETED: { id: 'Reset kata sandi selesai', en: 'Password reset completed' },
  LOCATION_ACCESS_GRANTED: { id: 'Akses lokasi diberikan', en: 'Location access granted' },
  LOCATION_ACCESS_REVOKED: { id: 'Akses lokasi dicabut', en: 'Location access revoked' },
};

const activityCategoryLabels: Record<string, LocalizedLabel> = {
  SECURITY: { id: 'Keamanan', en: 'Security' },
  CONFIGURATION: { id: 'Konfigurasi', en: 'Configuration' },
  FINANCE: { id: 'Keuangan', en: 'Finance' },
  CATALOG: { id: 'Katalog', en: 'Catalog' },
  TAX: { id: 'Pajak', en: 'Tax' },
  PRICING: { id: 'Harga', en: 'Pricing' },
  WORKFORCE: { id: 'Karyawan', en: 'Workforce' },
  SALES: { id: 'Penjualan', en: 'Sales' },
  PAYMENT: { id: 'Pembayaran', en: 'Payment' },
  FULFILLMENT: { id: 'Pengerjaan', en: 'Work' },
};

const activityTargetLabels: Record<string, LocalizedLabel> = {
  EXPENSE: { id: 'Pengeluaran', en: 'Expense' },
  INVITATION: { id: 'Undangan pengguna', en: 'User invitation' },
  NUMBERING_PREFERENCE: { id: 'Penomoran', en: 'Numbering' },
  BUSINESS_PREFERENCES: { id: 'Pengaturan bisnis', en: 'Business settings' },
  ROLE: { id: 'Peran', en: 'Role' },
  USER: { id: 'Pengguna', en: 'User' },
  LOCATION: { id: 'Lokasi', en: 'Location' },
  CATALOG_CATEGORY: { id: 'Kategori', en: 'Category' },
  CATALOG_ITEM: { id: 'Item katalog', en: 'Catalog item' },
  CATALOG_VARIANT: { id: 'Varian', en: 'Variant' },
  TAX_PROFILE: { id: 'Pengaturan pajak', en: 'Tax profile' },
  TAX_RULE: { id: 'Aturan pajak', en: 'Tax rule' },
  TAX_CATEGORY: { id: 'Kategori pajak', en: 'Tax category' },
  CATALOG_PRICE: { id: 'Harga', en: 'Price' },
  EMPLOYEE: { id: 'Karyawan', en: 'Employee' },
  EMPLOYEE_POSITION: { id: 'Jabatan karyawan', en: 'Employee position' },
  FINANCIAL_ACCOUNT: { id: 'Akun keuangan', en: 'Financial account' },
  PAYMENT_ROUTE: { id: 'Rute pembayaran', en: 'Payment route' },
  CASH_MOVEMENT: { id: 'Pergerakan kas', en: 'Cash movement' },
  SETTLEMENT: { id: 'Penyelesaian dana', en: 'Settlement' },
  RECONCILIATION: { id: 'Rekonsiliasi', en: 'Reconciliation' },
  SALE: { id: 'Transaksi', en: 'Transaction' },
  SALE_LINE: { id: 'Item transaksi', en: 'Transaction item' },
  PAYMENT: { id: 'Pembayaran', en: 'Payment' },
  FULFILLMENT: { id: 'Pengerjaan', en: 'Work' },
};

const activityNamespaceLabels: Record<string, LocalizedLabel> = {
  PRODUCT: { id: 'Produk', en: 'Product' },
  SERVICE: { id: 'Layanan', en: 'Service' },
  CATEGORY: { id: 'Kategori', en: 'Category' },
  VARIANT: { id: 'Varian', en: 'Variant' },
  EMPLOYEE: { id: 'Karyawan', en: 'Employee' },
  EMPLOYEE_POSITION: { id: 'Jabatan karyawan', en: 'Employee position' },
  SALE: { id: 'Transaksi', en: 'Transaction' },
  INVOICE: { id: 'Faktur', en: 'Invoice' },
};

function words(value: string): string {
  return value
    .replace(/[:_]+/g, '-')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function humanReadableLabel(value: string, locale: HumanLabelLocale): string {
  return technicalLabels[value]?.[locale] ?? words(value);
}

export function activityEventLabel(eventType: string, locale: HumanLabelLocale): string {
  return eventLabels[eventType]?.[locale] ?? words(eventType);
}

export function activityCategoryLabel(category: string, locale: HumanLabelLocale): string {
  return activityCategoryLabels[category]?.[locale] ?? words(category);
}

export function activityTargetLabel(targetType: string, locale: HumanLabelLocale): string {
  return activityTargetLabels[targetType]?.[locale] ?? words(targetType);
}

export function activityNamespaceLabel(namespace: string, locale: HumanLabelLocale): string {
  return activityNamespaceLabels[namespace]?.[locale] ?? humanReadableLabel(namespace, locale);
}
