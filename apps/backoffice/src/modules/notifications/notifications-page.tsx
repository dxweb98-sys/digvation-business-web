import { useRuntime } from '@digvation/business-runtime';
import { DBadge, DButton, DDataTable, useToast, type TableColumn } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { NotificationApi, type BusinessNotification } from './notification-api';
import {
  notificationContext,
  notificationSeverityLabel,
  notificationText,
  notificationTitle,
  safeNotificationPath,
} from './notification-i18n';

const defaultPageSize = 20;

export function NotificationsPage() {
  const runtime = useRuntime();
  const { session, createApiClient } = useBackofficeAuth();
  const { locale, formatDate, formatMoney } = useBackofficeLocalization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const notificationScope = session
    ? `${session.identity.workspace}:${session.identity.userId}`
    : 'unauthenticated';
  const api = useMemo(
    () => new NotificationApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const list = useQuery({
    queryKey: ['notifications', notificationScope, 'history', offset, pageSize],
    queryFn: () => api.list(pageSize, offset),
    refetchOnWindowFocus: true,
    enabled: Boolean(session),
  });
  const unread = useQuery({
    queryKey: ['notifications', notificationScope, 'unread-count'],
    queryFn: () => api.unreadCount(),
    refetchOnWindowFocus: true,
    enabled: Boolean(session),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['notifications', notificationScope],
    });
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
        title: notificationText(locale, 'markReadFailed'),
      });
      return false;
    }
  };
  const openNotification = async (notification: BusinessNotification) => {
    if (!(await markRead(notification))) return;
    const path = safeNotificationPath(notification.actionPath);
    if (path) navigate(path);
  };
  const markAllRead = async () => {
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

  const columns: TableColumn<BusinessNotification>[] = [
    {
      key: 'status',
      label: notificationText(locale, 'status'),
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
            ? notificationText(locale, 'read')
            : notificationText(locale, 'unread')}
        </span>
      ),
    },
    {
      key: 'notification',
      label: notificationText(locale, 'notification'),
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
      label: notificationText(locale, 'severity'),
      render: (notification) => (
        <DBadge variant="outline">
          {notificationSeverityLabel(locale, notification.severity)}
        </DBadge>
      ),
    },
    {
      key: 'time',
      label: notificationText(locale, 'time'),
      render: (notification) =>
        formatDate(new Date(notification.createdAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
  ];

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow="Backoffice"
        title={notificationText(locale, 'notifications')}
        description={notificationText(locale, 'description')}
        actions={
          (unread.data?.count ?? 0) > 0 ? (
            <DButton variant="secondary" onClick={() => void markAllRead()}>
              {notificationText(locale, 'markAllRead')}
            </DButton>
          ) : null
        }
      />
      <section className="mt-6">
        {list.isError ? (
          <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {notificationText(locale, 'loadFailed')}
            </p>
            <DButton
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void list.refetch()}
            >
              {notificationText(locale, 'retry')}
            </DButton>
          </div>
        ) : (
          <DDataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey="id"
            actions={[
              {
                label: notificationText(locale, 'open'),
                icon: <Eye aria-hidden="true" className="size-4" />,
                onClick: (notification) => void openNotification(notification),
                show: (notification) => Boolean(safeNotificationPath(notification.actionPath)),
              },
              {
                label: notificationText(locale, 'markRead'),
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
            emptyMessage={notificationText(locale, 'empty')}
          />
        )}
      </section>
    </BackofficePage>
  );
}
