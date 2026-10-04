import { useRuntime } from '@digvation/business-runtime';
import { DButton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { useFormState } from '../../../shared/forms/use-form-state';
import { usePaginationState } from '../../../shared/query/use-pagination-state';
import { ReportingApi, type ReportQuery } from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import { canAccessReport, type ReportType } from '../model/report-availability';
import { isCatalogReport, REPORT_CATALOG, reportDefinition } from '../model/report-catalog';
import { ReportControls, type ReportControlState } from './report-controls';
import { ReportInsights } from './report-insights';
import { ReportRecords } from './report-records';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Dashboard links open a report with `type`, period, and location in the URL. */
function initialState(today: string): ReportControlState {
  const search =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const from = search.get('dateFrom');
  const to = search.get('dateTo');
  const type = search.get('type');
  return {
    type: isCatalogReport(type) ? type : 'business-performance',
    dateFrom: from && DATE_KEY.test(from) ? from : today,
    dateTo: to && DATE_KEY.test(to) ? to : today,
    locationId: search.get('sellingLocationId') ?? '',
    search: '',
    filters: {},
  };
}

export function ReportsPage() {
  const { createApiClient, getAccessToken, session } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy } = useReportingLocalization();
  const api = useMemo(
    () => new ReportingApi(createApiClient(apiBaseUrl), apiBaseUrl, getAccessToken),
    [apiBaseUrl, createApiClient, getAccessToken],
  );
  const available = useMemo(
    () => REPORT_CATALOG.filter((definition) => canAccessReport(session, definition.type)),
    [session],
  );
  const today = new Date().toISOString().slice(0, 10);
  const initial = useMemo(() => initialState(today), [today]);
  const controls = useFormState<ReportControlState>(initial);
  const pagination = usePaginationState({ initialPageSize: 25 });
  const state = controls.values;
  const definition = available.some((report) => report.type === state.type)
    ? reportDefinition(state.type)
    : available[0];

  const locations = useQuery({
    queryKey: ['reporting-location-context'],
    queryFn: () => api.locationContext(),
    enabled: Boolean(definition?.locationScoped),
  });
  const knownLocation = locations.data?.locations.some(
    (location) => location.id === state.locationId,
  );
  const locationId = definition?.locationScoped
    ? (knownLocation ? state.locationId : '') ||
      (locations.data?.resolution === 'AUTO_RESOLVED'
        ? (locations.data.selectedLocationId ?? '')
        : '')
    : '';
  const needsLocation =
    Boolean(definition?.locationScoped) &&
    locations.data?.resolution === 'SELECTION_REQUIRED' &&
    !locationId;

  const query: ReportQuery = {
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    ...(locationId ? { sellingLocationId: locationId } : {}),
    ...(definition?.search && state.search.trim() ? { search: state.search.trim() } : {}),
    ...state.filters,
  };
  const report = useQuery({
    queryKey: ['reporting', definition?.type, query, pagination.page, pagination.pageSize],
    queryFn: () =>
      api.dataset(definition!.type, query, {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    enabled:
      Boolean(definition) && !needsLocation && (!definition?.locationScoped || locations.isSuccess),
  });
  // Never render one report's figures under another report's definition.
  const data = report.data?.type === definition?.type ? report.data : undefined;

  const change = (next: Partial<ReportControlState>) => {
    pagination.resetPage();
    controls.patch(next);
  };
  const changeType = (type: ReportType) => change({ type, search: '', filters: {} });

  if (!definition)
    return (
      <BackofficePage>
        <BackofficePageHeader eyebrow={copy('Reporting')} title={copy('Reports')} />
      </BackofficePage>
    );

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Reporting')}
        title={copy(definition.label)}
        description={copy('Business reports from recorded sales, workforce, and finance activity.')}
      />
      <div className="mt-5 space-y-5">
        <ReportControls
          api={api}
          session={session}
          definition={definition}
          available={available}
          state={{ ...state, type: definition.type, locationId }}
          locationContext={locations.data}
          exportQuery={query}
          total={definition.columns ? data?.total : undefined}
          onChange={change}
          onTypeChange={changeType}
          onReset={() =>
            change({
              dateFrom: initial.dateFrom,
              dateTo: initial.dateTo,
              locationId: '',
              search: '',
              filters: {},
            })
          }
        />
        {needsLocation ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
            {copy('Choose a location to see this report.')}
          </p>
        ) : report.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              {copy('Could not load this report.')}
            </p>
            <DButton
              variant="secondary"
              onClick={() => void report.refetch()}
              loading={report.isFetching}
            >
              {copy('Try again')}
            </DButton>
          </div>
        ) : (
          <>
            <ReportInsights definition={definition} data={data} period={query} />
            {definition.columns ? (
              <ReportRecords
                definition={definition}
                rows={data?.items ?? []}
                total={data?.total ?? 0}
                loading={report.isLoading}
                pagination={pagination}
                session={session}
                scope={{
                  query: {
                    dateFrom: query.dateFrom,
                    dateTo: query.dateTo,
                    ...(query.sellingLocationId
                      ? { sellingLocationId: query.sellingLocationId }
                      : {}),
                  },
                  locationName:
                    locations.data?.locations.find((location) => location.id === locationId)
                      ?.name ?? null,
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </BackofficePage>
  );
}
