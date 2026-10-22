import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DConnectionError,
  DDataTable,
  DDateRangeFilter,
  DSelectFilter,
  type TableColumn,
} from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import {
  activityCategoryLabel,
  humanReadableLabel,
} from '../../../app/localization/human-readable-labels';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import {
  ActivityApi,
  type ActivityActor,
  type ActivityEvent,
  type ActivitySource,
} from '../api/activity-api';
import { useActivityLocalization } from '../localization/use-activity-localization';
import {
  ACTIVITY_CATEGORIES,
  actionLabel,
  actorCompactLabel,
  actorContext,
  outcomeVariant,
  sourceLabel,
  targetSummary,
} from '../model/activity-presentation';
import { ActivityDetailDialog } from './activity-detail-dialog';

const defaultPageSize = 30;

export function ActivityPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { t, formatDateTime, locale, text } = useActivityLocalization();
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
  const [source, setSource] = useState<ActivitySource | ''>('');
  const [detail, setDetail] = useState<ActivityEvent | null>(null);

  const list = useQuery({
    queryKey: ['activity', offset, pageSize, from, to, actorUserId, category, locationId, source],
    queryFn: () =>
      api.list({
        offset,
        limit: pageSize,
        from,
        to,
        actorUserId,
        category,
        locationId,
        source: source || undefined,
      }),
  });
  const facets = useQuery({
    queryKey: ['activity-facets'],
    queryFn: () => api.facets(),
    staleTime: 300_000,
  });

  const resetPage = () => setOffset(0);
  const actorOptions = (facets.data?.actors ?? []).map((actor) => ({
    value: actor.id,
    label: actorCompactLabel(actor),
  }));
  const locationOptions = (facets.data?.locations ?? []).map((location) => ({
    value: location.id,
    label: `${location.name} (${location.code})`,
  }));
  const columns: TableColumn<ActivityEvent>[] = [
    {
      key: 'occurredAt',
      label: text.time,
      render: (item) => formatDateTime(item.occurredAt),
    },
    {
      key: 'actor',
      label: text.actor,
      render: (item) => (
        <ActorIdentity
          actor={item.actor}
          source={item.source}
          systemLabel={text.system}
          unknownLabel={text.unknown}
        />
      ),
    },
    {
      key: 'eventType',
      label: text.action,
      render: (item) => actionLabel(item.eventType, locale),
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
    {
      key: 'location',
      label: `${text.source} / ${text.location}`,
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <DBadge variant="outline">{sourceLabel(item.source, locale)}</DBadge>
          {item.locationName ? (
            <span className="text-xs text-[var(--color-text-muted)]">· {item.locationName}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'outcome',
      label: text.outcome,
      render: (item) => (
        <DBadge variant={outcomeVariant(item.outcome)}>
          {humanReadableLabel(item.outcome, locale)}
        </DBadge>
      ),
    },
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

  const filtered = Boolean(from || to || actorUserId || category || locationId || source);
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
                label={text.source}
                placeholder={text.allApplications}
                value={source || null}
                clearable
                options={(
                  [
                    ['BACKOFFICE', 'Backoffice'],
                    ['OPERATIONAL', 'Operational'],
                    ['SYSTEM', text.system],
                  ] as const
                ).map(([value, label]) => ({ value, label }))}
                onChange={(value) => {
                  setSource((value ?? '') as ActivitySource | '');
                  resetPage();
                }}
              />
              <DSelectFilter
                label={text.category}
                value={category || null}
                clearable
                options={ACTIVITY_CATEGORIES.map((value) => ({
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
      <ActivityDetailDialog item={detail} onClose={() => setDetail(null)} />
    </BackofficePage>
  );
}

function ActorIdentity({
  actor,
  source,
  systemLabel,
  unknownLabel,
}: {
  actor: ActivityActor | null;
  source: ActivityEvent['source'];
  systemLabel: string;
  unknownLabel: string;
}) {
  if (!actor) return <span>{source === 'SYSTEM' ? systemLabel : unknownLabel}</span>;
  const context = actorContext(actor);
  return (
    <div>
      <div className="font-medium text-[var(--color-text)]">{actor.displayName}</div>
      {context ? <div className="text-xs text-[var(--color-text-muted)]">{context}</div> : null}
    </div>
  );
}
