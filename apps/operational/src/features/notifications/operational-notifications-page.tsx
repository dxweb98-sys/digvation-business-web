import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { NotificationApi, type BusinessNotification } from './notification-api';
import {
  notificationContext,
  notificationSeverityLabel,
  notificationTitle,
  safeOperationalNotificationPath,
} from './operational-notification-bell';

const defaultPageSize = 20;

export function OperationalNotificationsPage() {
  const bootstrap = useDeploymentBootstrap();
  const { session, authPort } = useAuth();
  const { copy, locale, formatDate, formatMoney } = useOperationalLocalization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const scope = `${session.business.tenantId}:${session.identity.userId}`;
  const api = useMemo(
    () =>
      new NotificationApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );
  const list = useQuery({
    queryKey: ['notifications', scope, 'history', offset, pageSize],
    queryFn: () => api.list(pageSize, offset),
  });
  const unread = useQuery({
    queryKey: ['notifications', scope, 'unread-count'],
    queryFn: () => api.unreadCount(),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications', scope] });
  };
  const markRead = async (notification: BusinessNotification) => {
    if (notification.readAt) return true;
    try {
      await api.markRead(notification.id);
      await refresh();
      return true;
    } catch {
      showToast({
        variant: 'danger',
        title:
          locale === 'id-ID'
            ? 'Notifikasi belum dapat ditandai dibaca.'
            : 'Notification could not be marked as read.',
      });
      return false;
    }
  };
  const openNotification = async (notification: BusinessNotification) => {
    if (!(await markRead(notification))) return;
    const path = safeOperationalNotificationPath(notification.actionPath);
    if (path) navigate(path);
  };
  const markAllRead = async () => {
    try {
      await api.markAllRead();
      await refresh();
    } catch {
      showToast({
        variant: 'danger',
        title:
          locale === 'id-ID'
            ? 'Notifikasi belum dapat diperbarui.'
            : 'Notifications could not be updated.',
      });
    }
  };

  const columns: TableColumn<BusinessNotification>[] = [
    {
      key: 'status',
      label: copy('Status'),
      render: (notification) => (
        <span className="inline-flex items-center gap-2 text-sm">
          <span
            className={[
              'size-2 rounded-full',
              notification.readAt ? 'bg-[var(--color-border)]' : 'bg-[var(--color-brand)]',
            ].join(' ')}
            aria-hidden="true"
          />
          {notification.readAt
            ? locale === 'id-ID'
              ? 'Sudah dibaca'
              : 'Read'
            : locale === 'id-ID'
              ? 'Belum dibaca'
              : 'Unread'}
        </span>
      ),
    },
    {
      key: 'notification',
      label: locale === 'id-ID' ? 'Notifikasi' : 'Notification',
      render: (notification) => (
        <div className="max-w-xl">
          <p className="font-medium text-[var(--color-text)]">
            {notificationTitle(locale, notification)}
          </p>
          <p className="mt-1 text-sm leading-5 text-[var(--color-text-muted)]">
            {notificationContext(locale, notification, formatMoney)}
          </p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: locale === 'id-ID' ? 'Prioritas' : 'Priority',
      render: (notification) => (
        <DBadge
          variant={
            notification.severity === 'CRITICAL'
              ? 'danger'
              : notification.severity === 'WARNING'
                ? 'warning'
                : 'outline'
          }
        >
          {notificationSeverityLabel(locale, notification.severity)}
        </DBadge>
      ),
    },
    {
      key: 'time',
      label: locale === 'id-ID' ? 'Waktu' : 'Time',
      render: (notification) =>
        formatDate(new Date(notification.createdAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
  ];

  return (
    <main className="p-5 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Operations')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-(--color-text)">
            {locale === 'id-ID' ? 'Notifikasi' : 'Notifications'}
          </h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {locale === 'id-ID'
              ? 'Riwayat notifikasi akun Anda.'
              : 'Your account notification history.'}
          </p>
        </div>
        {(unread.data?.count ?? 0) > 0 ? (
          <DButton variant="secondary" onClick={() => void markAllRead()}>
            {locale === 'id-ID' ? 'Tandai semua dibaca' : 'Mark all read'}
          </DButton>
        ) : null}
      </header>
      <section className="mt-6">
        {list.isError ? (
          <DConnectionError
            title={
              locale === 'id-ID'
                ? 'Notifikasi tidak dapat dimuat.'
                : 'Could not load notifications.'
            }
            message={
              locale === 'id-ID'
                ? 'Coba muat ulang notifikasi.'
                : 'Try loading notifications again.'
            }
            onRetry={() => void list.refetch()}
            isRetrying={list.isFetching}
          />
        ) : (
          <DDataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey="id"
            actions={[
              {
                label: locale === 'id-ID' ? 'Buka' : 'Open',
                icon: <Eye aria-hidden="true" className="size-4" />,
                onClick: (notification) => void openNotification(notification),
                show: (notification) =>
                  Boolean(safeOperationalNotificationPath(notification.actionPath)),
              },
              {
                label: locale === 'id-ID' ? 'Tandai dibaca' : 'Mark read',
                icon: <Check aria-hidden="true" className="size-4" />,
                onClick: (notification) => void markRead(notification),
                show: (notification) => !notification.readAt,
              },
            ]}
            pagination={{
              page: Math.floor(offset / pageSize) + 1,
              pageSize,
              total: list.data?.total ?? 0,
            }}
            onPageChange={(page) => setOffset((page - 1) * pageSize)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setOffset(0);
            }}
            emptyMessage={locale === 'id-ID' ? 'Belum ada notifikasi.' : 'No notifications yet.'}
          />
        )}
      </section>
    </main>
  );
}
