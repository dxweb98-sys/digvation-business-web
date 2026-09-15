import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useRuntime } from '@digvation/business-runtime';
import { DButton, DDropdown, useToast } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { NotificationApi, type BusinessNotification } from './notification-api';

const recentLimit = 6;
const refreshIntervalMs = 60_000;

export function OperationalNotificationBell() {
  const runtime = useRuntime();
  const { session, authPort } = useAuth();
  const { locale, formatDate, formatMoney } = useOperationalLocalization();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const notificationScope = `${session.identity.workspace}:${session.identity.userId}`;
  const api = useMemo(
    () =>
      new NotificationApi(
        new ApiClient({
          baseUrl: runtime.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, runtime.apiBaseUrl],
  );
  const unread = useQuery({
    queryKey: ['notifications', notificationScope, 'unread-count'],
    queryFn: () => api.unreadCount(),
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: true,
  });
  const recent = useQuery({
    queryKey: ['notifications', notificationScope, 'recent'],
    queryFn: () => api.list(recentLimit, 0),
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: true,
  });

  const [previousLocationKey, setPreviousLocationKey] = useState(location.key);
  if (previousLocationKey !== location.key) {
    setPreviousLocationKey(location.key);
    setOpen(false);
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['notifications', notificationScope],
    });
  };

  const markAllRead = async () => {
    if (!unread.data?.count) return;
    try {
      await api.markAllRead();
      await refresh();
    } catch {
      showToast({
        variant: 'danger',
        title:
          locale === 'id-ID'
            ? 'Semua notifikasi tidak dapat ditandai sebagai dibaca.'
            : 'Notifications could not be marked as read.',
      });
    }
  };

  const handleNotification = async (notification: BusinessNotification) => {
    if (!notification.readAt) {
      try {
        await api.markRead(notification.id);
        await refresh();
      } catch {
        showToast({
          variant: 'danger',
          title:
            locale === 'id-ID'
              ? 'Notifikasi tidak dapat ditandai sebagai dibaca.'
              : 'The notification could not be marked as read.',
        });
        return;
      }
    }
    const actionPath = safeOperationalNotificationPath(notification.actionPath);
    if (actionPath) {
      setOpen(false);
      navigate(actionPath);
    }
  };

  const count = unread.data?.count ?? 0;
  return (
    <DDropdown
      open={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      contentPadding={false}
      minWidth={0}
      contentClassName="w-[min(390px,calc(100vw-24px))] overflow-hidden"
      trigger={() => (
        <div className="relative">
          <DButton
            variant="ghost"
            size="icon"
            aria-label={locale === 'id-ID' ? 'Notifikasi' : 'Notifications'}
          >
            <Bell className="size-[18px]" />
          </DButton>
          {count > 0 ? (
            <span className="pointer-events-none absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-4 text-white">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </div>
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {locale === 'id-ID' ? 'Notifikasi' : 'Notifications'}
            </p>
            {count > 0 ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {count} {locale === 'id-ID' ? 'belum dibaca' : 'unread'}
              </p>
            ) : null}
          </div>
          {count > 0 ? (
            <DButton variant="ghost" size="sm" onClick={() => void markAllRead()}>
              {locale === 'id-ID' ? 'Tandai semua dibaca' : 'Mark all read'}
            </DButton>
          ) : null}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {recent.isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              {locale === 'id-ID' ? 'Memuat notifikasi...' : 'Loading notifications...'}
            </p>
          ) : recent.isError ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {locale === 'id-ID'
                  ? 'Notifikasi tidak dapat dimuat.'
                  : 'Notifications could not be loaded.'}
              </p>
              <DButton
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => void recent.refetch()}
              >
                {locale === 'id-ID' ? 'Coba lagi' : 'Retry'}
              </DButton>
            </div>
          ) : recent.data?.items.length ? (
            recent.data.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => void handleNotification(notification)}
                className={[
                  'flex w-full items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-muted)]',
                  notification.readAt ? '' : 'bg-[var(--color-brand)]/[0.04]',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    notification.readAt ? 'bg-transparent' : 'bg-[var(--color-brand)]',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--color-text)]">
                    {notificationTitle(locale, notification)}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">
                    {notificationContext(locale, notification, formatMoney)}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-[var(--color-text-muted)]">
                    {formatDate(new Date(notification.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
              {locale === 'id-ID' ? 'Belum ada notifikasi.' : 'No notifications yet.'}
            </p>
          )}
        </div>
      </div>
    </DDropdown>
  );
}

function notificationTitle(
  locale: 'id-ID' | 'en-US',
  notification: BusinessNotification,
): string {
  const id = locale === 'id-ID';
  switch (notification.type) {
    case 'EXPENSE_APPROVAL_REQUIRED':
      return id ? 'Persetujuan pengeluaran diperlukan' : 'Expense approval required';
    case 'EXPENSE_APPROVED':
      return id ? 'Pengeluaran disetujui' : 'Expense approved';
    case 'EXPENSE_REJECTED':
      return id ? 'Pengeluaran ditolak' : 'Expense rejected';
    case 'PAYMENT_FAILED':
      return id ? 'Pembayaran gagal' : 'Payment failed';
  }
}

function notificationContext(
  locale: 'id-ID' | 'en-US',
  notification: BusinessNotification,
  formatMoney: (amount: string, currency: string) => string,
): string {
  const id = locale === 'id-ID';
  const data = notification.displayData;
  const amount = stringValue(data.amount);
  const currency = stringValue(data.currency);
  const money = amount && currency ? formatMoney(amount, currency) : null;
  const location = stringValue(data.sellingLocationName);

  switch (notification.type) {
    case 'EXPENSE_APPROVAL_REQUIRED':
      return id
        ? `${money ?? 'Pengeluaran'}${location ? ` di ${location}` : ''} menunggu persetujuan.`
        : `${money ?? 'Expense'}${location ? ` at ${location}` : ''} is waiting for approval.`;
    case 'EXPENSE_APPROVED':
      return id
        ? `${money ?? 'Pengeluaran'}${location ? ` di ${location}` : ''} telah disetujui.`
        : `${money ?? 'Expense'}${location ? ` at ${location}` : ''} was approved.`;
    case 'EXPENSE_REJECTED': {
      const note = stringValue(data.rejectionNote);
      return id
        ? `${money ?? 'Pengeluaran'} ditolak${note ? `: ${note}` : '.'}`
        : `${money ?? 'Expense'} was rejected${note ? `: ${note}` : '.'}`;
    }
    case 'PAYMENT_FAILED': {
      const saleNumber = stringValue(data.saleNumber);
      const method = paymentMethodLabel(locale, stringValue(data.paymentMethod));
      return id
        ? `Pembayaran${method ? ` ${method}` : ''}${saleNumber ? ` untuk ${saleNumber}` : ''}${money ? ` sebesar ${money}` : ''} gagal.`
        : `${method ? `${method} p` : 'P'}ayment${saleNumber ? ` for ${saleNumber}` : ''}${money ? ` for ${money}` : ''} failed.`;
    }
  }
}

function safeOperationalNotificationPath(path: string | null): string | null {
  return path === '/expenses' || path === '/transactions' ? path : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function paymentMethodLabel(locale: 'id-ID' | 'en-US', value: string | null): string | null {
  if (!value) return null;
  const labels: Record<string, { 'id-ID': string; 'en-US': string }> = {
    CASH: { 'id-ID': 'tunai', 'en-US': 'cash' },
    BANK_TRANSFER: { 'id-ID': 'transfer bank', 'en-US': 'bank transfer' },
    WALLET: { 'id-ID': 'dompet digital', 'en-US': 'wallet' },
    QRIS: { 'id-ID': 'QRIS', 'en-US': 'QRIS' },
  };
  return labels[value]?.[locale] ?? value.toLowerCase().replaceAll('_', ' ');
}
