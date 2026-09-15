import type { BackofficeLocale } from '../../app/localization/backoffice-localization';
import type { BusinessNotification, NotificationSeverity } from './notification-api';

type TextKey =
  | 'notifications'
  | 'description'
  | 'markAllRead'
  | 'markRead'
  | 'viewAll'
  | 'open'
  | 'unread'
  | 'read'
  | 'empty'
  | 'loading'
  | 'loadFailed'
  | 'retry'
  | 'status'
  | 'notification'
  | 'severity'
  | 'time'
  | 'info'
  | 'warning'
  | 'critical'
  | 'markReadFailed'
  | 'markAllReadFailed';

const text: Record<TextKey, { id: string; en: string }> = {
  notifications: { id: 'Notifikasi', en: 'Notifications' },
  description: {
    id: 'Informasi yang perlu Anda ketahui atau tindak lanjuti.',
    en: 'Information that needs your awareness or action.',
  },
  markAllRead: { id: 'Tandai semua dibaca', en: 'Mark all read' },
  markRead: { id: 'Tandai dibaca', en: 'Mark read' },
  viewAll: { id: 'Lihat semua notifikasi', en: 'View all notifications' },
  open: { id: 'Buka', en: 'Open' },
  unread: { id: 'Belum dibaca', en: 'Unread' },
  read: { id: 'Sudah dibaca', en: 'Read' },
  empty: { id: 'Belum ada notifikasi.', en: 'No notifications yet.' },
  loading: { id: 'Memuat notifikasi...', en: 'Loading notifications...' },
  loadFailed: {
    id: 'Notifikasi tidak dapat dimuat.',
    en: 'Notifications could not be loaded.',
  },
  retry: { id: 'Coba lagi', en: 'Retry' },
  status: { id: 'Status', en: 'Status' },
  notification: { id: 'Notifikasi', en: 'Notification' },
  severity: { id: 'Prioritas', en: 'Priority' },
  time: { id: 'Waktu', en: 'Time' },
  info: { id: 'Info', en: 'Info' },
  warning: { id: 'Perlu perhatian', en: 'Needs attention' },
  critical: { id: 'Kritis', en: 'Critical' },
  markReadFailed: {
    id: 'Notifikasi tidak dapat ditandai sebagai dibaca.',
    en: 'The notification could not be marked as read.',
  },
  markAllReadFailed: {
    id: 'Semua notifikasi tidak dapat ditandai sebagai dibaca.',
    en: 'Notifications could not be marked as read.',
  },
};

export function notificationText(locale: BackofficeLocale, key: TextKey) {
  return text[key][locale];
}

export function notificationSeverityLabel(
  locale: BackofficeLocale,
  severity: NotificationSeverity,
) {
  if (severity === 'CRITICAL') return notificationText(locale, 'critical');
  if (severity === 'WARNING') return notificationText(locale, 'warning');
  return notificationText(locale, 'info');
}

export function notificationTitle(locale: BackofficeLocale, notification: BusinessNotification) {
  const titles: Record<BusinessNotification['type'], { id: string; en: string }> = {
    EXPENSE_APPROVAL_REQUIRED: {
      id: 'Persetujuan pengeluaran diperlukan',
      en: 'Expense approval required',
    },
    EXPENSE_APPROVED: {
      id: 'Pengeluaran disetujui',
      en: 'Expense approved',
    },
    EXPENSE_REJECTED: {
      id: 'Pengeluaran ditolak',
      en: 'Expense rejected',
    },
    PAYMENT_FAILED: {
      id: 'Pembayaran gagal',
      en: 'Payment failed',
    },
  };
  return titles[notification.type][locale];
}

export function notificationContext(
  locale: BackofficeLocale,
  notification: BusinessNotification,
  formatMoney: (amount: string, currency: string) => string,
) {
  const data = notification.displayData;
  const amount = stringValue(data.amount);
  const currency = stringValue(data.currency);
  const money = amount && currency ? formatMoney(amount, currency) : null;
  const location = stringValue(data.sellingLocationName);

  switch (notification.type) {
    case 'EXPENSE_APPROVAL_REQUIRED':
      return locale === 'id'
        ? `${money ?? 'Pengeluaran'}${location ? ` di ${location}` : ''} menunggu persetujuan.`
        : `${money ?? 'Expense'}${location ? ` at ${location}` : ''} is waiting for approval.`;
    case 'EXPENSE_APPROVED':
      return locale === 'id'
        ? `${money ?? 'Pengeluaran'}${location ? ` di ${location}` : ''} telah disetujui.`
        : `${money ?? 'Expense'}${location ? ` at ${location}` : ''} was approved.`;
    case 'EXPENSE_REJECTED': {
      const note = stringValue(data.rejectionNote);
      return locale === 'id'
        ? `${money ?? 'Pengeluaran'} ditolak${note ? `: ${note}` : '.'}`
        : `${money ?? 'Expense'} was rejected${note ? `: ${note}` : '.'}`;
    }
    case 'PAYMENT_FAILED': {
      const saleNumber = stringValue(data.saleNumber);
      const method = paymentMethodLabel(locale, stringValue(data.paymentMethod));
      return locale === 'id'
        ? `Pembayaran${method ? ` ${method}` : ''}${saleNumber ? ` untuk ${saleNumber}` : ''}${money ? ` sebesar ${money}` : ''} gagal.`
        : `${method ? `${method} p` : 'P'}ayment${saleNumber ? ` for ${saleNumber}` : ''}${money ? ` for ${money}` : ''} failed.`;
    }
  }
}

export function safeNotificationPath(path: string | null) {
  return path === '/expenses' || path === '/transactions' ? path : null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function paymentMethodLabel(locale: BackofficeLocale, value: string | null): string | null {
  if (!value) return null;
  const labels: Record<string, { id: string; en: string }> = {
    CASH: { id: 'tunai', en: 'cash' },
    BANK_TRANSFER: { id: 'transfer bank', en: 'bank transfer' },
    WALLET: { id: 'dompet digital', en: 'wallet' },
    QRIS: { id: 'QRIS', en: 'QRIS' },
  };
  return labels[value]?.[locale] ?? value.toLowerCase().replaceAll('_', ' ');
}
