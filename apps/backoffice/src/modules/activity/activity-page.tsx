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
import { useRuntime } from '@digvation/business-runtime';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  activityCategoryLabel,
  activityEventLabel,
  activityNamespaceLabel,
  activityTargetLabel,
  humanReadableLabel,
  type HumanLabelLocale,
} from '../../app/localization/human-readable-labels';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { ActivityApi, type ActivityEvent } from './activity-api';

const defaultPageSize = 30;
const activityCategories = [
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

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, copy, formatDate, locale } = useBackofficeLocalization();
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
    queryFn: () => api.list({ offset, limit: pageSize, from, to, actorUserId, category, locationId }),
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
      label: copy('Time'),
      render: (item) =>
        formatDate(new Date(item.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'actor',
      label: copy('Actor'),
      render: (item) => item.actor?.displayName ?? copy('System'),
    },
    {
      key: 'eventType',
      label: copy('Action'),
      render: (item) => activityEventLabel(item.eventType, locale),
    },
    {
      key: 'target',
      label: copy('Target / reference'),
      render: (item) => targetSummary(item, locale) ?? '-',
    },
    {
      key: 'category',
      label: copy('Category'),
      render: (item) => (
        <DBadge variant="outline">{activityCategoryLabel(item.category, locale)}</DBadge>
      ),
    },
    {
      key: 'location',
      label: copy('Location'),
      render: (item) => item.locationName ?? '-',
    },
  ];
  if (list.isError) {
    return (
      <DConnectionError
        title={copy('Could not load activity.')}
        message={copy('Try loading activity again.')}
        onRetry={() => void list.refetch()}
        isRetrying={list.isFetching}
      />
    );
  }
  const filtered = Boolean(from || to || actorUserId || category || locationId);
  return (
    <BackofficePage>
      <BackofficePageHeader eyebrow={copy('Audit')} title={t('activity')} />
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
                label={copy('User')}
                placeholder={copy('All users')}
                value={actorUserId || null}
                clearable
                options={actorOptions}
                onChange={(value) => {
                  setActorUserId(String(value ?? ''));
                  resetPage();
                }}
              />
              <DSelectFilter
                label={copy('Category')}
                value={category || null}
                clearable
                options={activityCategories.map((value) => ({
                  value,
                  label: activityCategoryLabel(value, locale),
                }))}
                onChange={(value) => {
                  setCategory(String(value ?? ''));
                  resetPage();
                }}
              />
              <DSelectFilter
                label={copy('Location')}
                placeholder={copy('All locations')}
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
          emptyMessage={copy(
            filtered
              ? 'No activity matches the current filters.'
              : 'No activity has been recorded yet.',
          )}
        />
      </section>
      <ActivityDetail item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActivityDetail({ item, onClose }: { item: ActivityEvent | null; onClose: () => void }) {
  const { copy, formatDate, locale } = useBackofficeLocalization();
  const target = item ? targetSummary(item, locale) : undefined;
  const reference = item && ((hasBusinessTarget(item) && item.target?.id) || item.correlationId);
  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      title={item ? activityEventLabel(item.eventType, locale) : copy('Activity details')}
      description={
        item
          ? formatDate(new Date(item.occurredAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : undefined
      }
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {item ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <DBadge variant="outline">{activityCategoryLabel(item.category, locale)}</DBadge>
            <DBadge variant="outline">{humanReadableLabel(item.outcome, locale)}</DBadge>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Fact label={copy('Actor')} value={item.actor?.displayName ?? copy('System')} />
            {target ? <Fact label={copy('Affected item')} value={target} /> : null}
            {item.locationName ? <Fact label={copy('Location')} value={item.locationName} /> : null}
            <Fact label={copy('Source')} value={sourceLabel(item.source, locale)} />
          </dl>
          {reference ? (
            <section className="border-t border-[var(--color-border)] pt-4">
              <h3 className="text-sm font-semibold">
                {locale === 'id' ? 'Informasi referensi' : 'Reference information'}
              </h3>
              <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                {hasBusinessTarget(item) && item.target?.id ? (
                  <Fact
                    label={locale === 'id' ? 'ID data' : 'Data ID'}
                    value={item.target.id}
                    technical
                  />
                ) : null}
                {item.correlationId ? (
                  <Fact
                    label={locale === 'id' ? 'ID permintaan' : 'Request ID'}
                    value={item.correlationId}
                    technical
                  />
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </DDialog>
  );
}

function Fact({
  label,
  value,
  technical = false,
}: {
  label: string;
  value: string;
  technical?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd
        className={`mt-1 break-words text-[var(--color-text)]${technical ? ' font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function targetSummary(item: ActivityEvent, locale: HumanLabelLocale): string | undefined {
  if (!item.target || !hasBusinessTarget(item)) return undefined;
  const display = item.target.displayName;
  const reference = item.target.reference
    ? activityNamespaceLabel(item.target.reference, locale)
    : undefined;
  const fallback = activityTargetLabel(item.target.type, locale);
  const target = display ?? fallback;
  return reference ? `${target} (${reference})` : target;
}

function hasBusinessTarget(item: ActivityEvent) {
  return item.eventType !== 'LOGIN_SUCCEEDED' && item.eventType !== 'LOGOUT';
}

function sourceLabel(value: ActivityEvent['source'], locale: HumanLabelLocale) {
  if (value === 'OPERATIONAL') return 'Operational';
  if (value === 'SYSTEM') return locale === 'id' ? 'Sistem' : 'System';
  return 'Backoffice';
}
