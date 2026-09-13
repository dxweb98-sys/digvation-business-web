import { useRuntime } from '@digvation/business-runtime';
import { DButton, DDropdown, useToast } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { NotificationApi, type BusinessNotification } from './notification-api';
import {
  notificationContext,
  notificationText,
  notificationTitle,
  safeNotificationPath,
} from './notification-i18n';

const recentLimit = 6;
const refreshIntervalMs = 60_000;

export function NotificationBell() {
  const runtime = useRuntime();
  const { session, createApiClient } = useBackofficeAuth();
  const { locale, formatDate, formatMoney, t } = useBackofficeLocalization();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const notificationScope = session
    ? `${session.identity.workspace}:${session.identity.userId}`
    : 'unauthenticated';
  const api = useMemo(
    () => new NotificationApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const unread = useQuery({
    queryKey: ['notifications', notificationScope, 'unread-count'],
    queryFn: () => api.unreadCount(),
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: true,
    enabled: Boolean(session),
  });
  const recent = useQuery({
    queryKey: ['notifications', notificationScope, 'recent'],
    queryFn: () => api.list(recentLimit, 0),
    refetchInterval: refreshIntervalMs,
    refetchOnWindowFocus: true,
    enabled: Boolean(session),
  });

  useEffect(() => setOpen(false), [location.key]);

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
        title: notificationText(locale, 'markAllReadFailed'),
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
          title: notificationText(locale, 'markReadFailed'),
        });
        return;
      }
    }
    const actionPath = safeNotificationPath(notification.actionPath);
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
          <DButton variant="ghost" size="icon" aria-label={t('notifications')}>
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
              {notificationText(locale, 'notifications')}
            </p>
            {count > 0 ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {count} {notificationText(locale, 'unread').toLowerCase()}
              </p>
            ) : null}
          </div>
          {count > 0 ? (
            <DButton variant="ghost" size="sm" onClick={() => void markAllRead()}>
              {notificationText(locale, 'markAllRead')}
            </DButton>
          ) : null}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {recent.isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
              {notificationText(locale, 'loading')}
            </p>
          ) : recent.isError ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                {notificationText(locale, 'loadFailed')}
              </p>
              <DButton
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => void recent.refetch()}
              >
                {notificationText(locale, 'retry')}
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
              {notificationText(locale, 'empty')}
            </p>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] p-2">
          <DButton
            variant="ghost"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            {notificationText(locale, 'viewAll')}
          </DButton>
        </div>
      </div>
    </DDropdown>
  );
}
