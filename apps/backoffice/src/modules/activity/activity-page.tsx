import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DConnectionError,
  DDataTable,
  DDateRangeFilter,
  DDialog,
  DSelectFilter,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  activityCategoryLabel,
  activityEventLabel,
  activityNamespaceLabel,
  activityTargetLabel,
  humanReadableLabel,
} from '../../app/localization/human-readable-labels';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { ActivityApi, type ActivityEvent } from './activity-api';

const defaultPageSize = 30;
const categories = [
  'SECURITY',
  'CONFIGURATION',
  'FINANCE',
  'CATALOG',
  'TAX',
  'PRICING',
  'WORKFORCE',
  'SALES',
  'PAYMENT',
  'FULFILLMENT',
] as const;

const pageCopy = {
  id: {
    audit: 'Audit',
    time: 'Waktu',
    actor: 'Pelaku',
    action: 'Tindakan',
    target: 'Objek',
    category: 'Kategori',
    location: 'Lokasi',
    user: 'Pengguna',
    allUsers: 'Semua pengguna',
    allLocations: 'Semua lokasi',
    system: 'Sistem',
    source: 'Aplikasi',
    affectedItem: 'Objek',
    activityDetails: 'Detail aktivitas',
    loadFailed: 'Aktivitas tidak dapat dimuat.',
    retry: 'Coba muat ulang aktivitas.',
    empty: 'Belum ada aktivitas.',
    emptyFiltered: 'Tidak ada aktivitas yang sesuai filter.',
    close: 'Tutup',
  },
  en: {
    audit: 'Audit',
    time: 'Time',
    actor: 'Actor',
    action: 'Action',
    target: 'Target',
    category: 'Category',
    location: 'Location',
    user: 'User',
    allUsers: 'All users',
    allLocations: 'All locations',
    system: 'System',
    source: 'Application',
    affectedItem: 'Target',
    activityDetails: 'Activity details',
    loadFailed: 'Could not load activity.',
    retry: 'Try loading activity again.',
    empty: 'No activity has been recorded yet.',
    emptyFiltered: 'No activity matches the current filters.',
    close: 'Close',
  },
} as const;

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, formatDate, locale } = useBackofficeLocalization();
  const text = pageCopy[locale];
  const api = useMemo(
    () => new ActivityApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [category, setCategory] = useState('');
  const [locationId, setLocationId] = useState('');
  const [detail, setDetail] = useState<ActivityEvent | null>(null);

  const list = useQuery({
    queryKey: ['activity', offset, pageSize, from, to, actorUserId, category, locationId],
    queryFn: () =>
      api.list({ offset, limit: pageSize, from, to, actorUserId, category, locationId }),
  });
  const facets = useQuery({
    queryKey: ['activity-facets'],
    queryFn: () => api.facets(),
    staleTime: 300_000,
  });

  const resetPage = () => setOffset(0);
  const actorOptions = (facets.data?.actors ?? []).map((actor) => ({
    value: actor.id,
    label: actor.displayName,
  }));
  const locationOptions = (facets.data?.locations ?? []).map((location) => ({
    value: location.id,
    label: `${location.name} (${location.code})`,
  }));
  const columns: TableColumn<ActivityEvent>[] = [
    {
      key: 'occurredAt',
      label: text.time,
      render: (item) =>
        formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'actor',
      label: text.actor,
      render: (item) => item.actor?.displayName ?? text.system,
    },
    {
      key: 'eventType',
      label: text.action,
      render: (item) => activityEventLabel(item.eventType, locale),
    },
    {
      key: 'target',
      label: text.target,
      render: (item) => targetSummary(item, locale) ?? '-',
    },
    {
      key: 'category',
      label: text.category,
      render: (item) => (
        <DBadge variant="outline">{activityCategoryLabel(item.category, locale)}</DBadge>
      ),
    },
    { key: 'location', label: text.location, render: (item) => item.locationName ?? '-' },
  ];

  if (list.isError) {
    return (
      <DConnectionError
        title={text.loadFailed}
        message={text.retry}
        onRetry={() => void list.refetch()}
        isRetrying={list.isFetching}
      />
    );
  }

  const filtered = Boolean(from || to || actorUserId || category || locationId);
  return (
    <BackofficePage>
      <BackofficePageHeader eyebrow={text.audit} title={t('activity')} />
      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          onRowClick={setDetail}
          filters={
            <div className="flex flex-wrap gap-2">
              <DDateRangeFilter
                from={from}
                to={to}
                onFromChange={(value) => {
                  setFrom(value);
                  resetPage();
                }}
                onToChange={(value) => {
                  setTo(value);
                  resetPage();
                }}
                onClear={() => {
                  setFrom('');
                  setTo('');
                  resetPage();
                }}
              />
              <DSelectFilter
                label={text.user}
                placeholder={text.allUsers}
                value={actorUserId || null}
                clearable
                options={actorOptions}
                onChange={(value) => {
                  setActorUserId(String(value ?? ''));
                  resetPage();
                }}
              />
              <DSelectFilter
                label={text.category}
                value={category || null}
                clearable
                options={categories.map((value) => ({
                  value,
                  label: activityCategoryLabel(value, locale),
                }))}
                onChange={(value) => {
                  setCategory(String(value ?? ''));
                  resetPage();
                }}
              />
              <DSelectFilter
                label={text.location}
                placeholder={text.allLocations}
                value={locationId || null}
                clearable
                options={locationOptions}
                onChange={(value) => {
                  setLocationId(String(value ?? ''));
                  resetPage();
                }}
              />
            </div>
          }
          pagination={{
            page: Math.floor(offset / pageSize) + 1,
            pageSize,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            resetPage();
          }}
          emptyMessage={filtered ? text.emptyFiltered : text.empty}
        />
      </section>
      <ActivityDetail item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityEvent | null; onClose: () => void }) {
  const { formatDate, locale } = useBackofficeLocalization();
  const text = pageCopy[locale];
  const target = item ? targetSummary(item, locale) : undefined;

  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      title={item ? activityEventLabel(item.eventType, locale) : text.activityDetails}
      description={
        item
          ? formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' })
          : undefined
      }
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {text.close}
          </DButton>
        </div>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="outline">{activityCategoryLabel(item.category, locale)}</DBadge>
            <DBadge variant={outcomeVariant(item.outcome)}>
              {humanReadableLabel(item.outcome, locale)}
            </DBadge>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Fact label={text.actor} value={item.actor?.displayName ?? text.system} />
            {target ? <Fact label={text.affectedItem} value={target} /> : null}
            {item.locationName ? <Fact label={text.location} value={item.locationName} /> : null}
            <Fact label={text.source} value={sourceLabel(item.source, locale)} />
          </dl>
        </div>
      ) : null}
    </DDialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function targetSummary(item: ActivityEvent, locale: 'id' | 'en'): string | undefined {
  if (!item.target || !hasBusinessTarget(item)) return undefined;
  const display = item.target.displayName;
  const reference = item.target.reference
    ? activityNamespaceLabel(item.target.reference, locale)
    : undefined;
  const fallback = activityTargetLabel(item.target.type, locale);
  return [display ?? fallback, reference].filter(Boolean).join(' (') + (reference ? ')' : '');
}

function hasBusinessTarget(item: ActivityEvent) {
  return item.eventType !== 'LOGIN_SUCCEEDED' && item.eventType !== 'LOGOUT';
}

function outcomeVariant(value: string): 'success' | 'warning' | 'danger' | 'outline' {
  return value === 'SUCCEEDED'
    ? 'success'
    : value === 'REJECTED'
      ? 'warning'
      : value === 'FAILED'
        ? 'danger'
        : 'outline';
}

function sourceLabel(value: ActivityEvent['source'], locale: 'id' | 'en') {
  if (value === 'SYSTEM') return locale === 'id' ? 'Sistem' : 'System';
  if (value === 'OPERATIONAL') return 'Operational';
  return 'Backoffice';
}
