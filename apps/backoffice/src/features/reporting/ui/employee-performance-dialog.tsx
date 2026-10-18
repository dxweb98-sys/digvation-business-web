import { useRuntime } from '@digvation/business-runtime';
import { DBadge, DConnectionError, DDataTable, DSkeleton, type TableColumn } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import {
  ReportingApi,
  type EmployeeContributionDetail,
  type ReportQuery,
  type ReportRow,
} from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import { formatReportValue } from '../model/report-format';
import { DetailShell, UnavailableDetail } from './report-detail-shell';

type ContributionRecord = EmployeeContributionDetail['records']['items'][number];

/** The report scope the employee is read in: the same period and location as the ranking. */
export interface EmployeeDetailScope {
  query: Pick<ReportQuery, 'dateFrom' | 'dateTo' | 'sellingLocationId'>;
  /** `null` when the report covers every permitted location. */
  locationName: string | null;
}

const RECORDS_PAGE_SIZE = 10;

/** A share is read, not audited: one decimal is enough (58.4%). */
const shareText = (share: string, locale: string) =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(share) * 100)}%`;

/**
 * One employee's contribution for the selected period and location. Every figure comes from the
 * same finalized contribution facts as the ranking row, so the two always reconcile.
 */
export function EmployeePerformanceDialog({
  row,
  scope,
  open,
  onClose,
}: {
  row: ReportRow;
  scope: EmployeeDetailScope;
  open: boolean;
  onClose: () => void;
}) {
  const { createApiClient, getAccessToken } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy, format } = useReportingLocalization();
  const api = useMemo(
    () => new ReportingApi(createApiClient(apiBaseUrl), apiBaseUrl, getAccessToken),
    [apiBaseUrl, createApiClient, getAccessToken],
  );
  const employeeId = String(row.employeeId ?? '');
  const [page, setPage] = useState(1);
  const detail = useQuery({
    queryKey: ['reporting-employee-detail', employeeId, scope.query, page],
    queryFn: () =>
      api.employeeDetail(employeeId, scope.query, { page, pageSize: RECORDS_PAGE_SIZE }),
    enabled: open && Boolean(employeeId),
    // Keep the visible records only while paging the SAME employee: another employee's
    // figures must never stand in for the one being opened.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === employeeId ? previous : undefined,
    // A failed read is reported promptly instead of looking like a long load.
    retry: 1,
  });
  const money = (value: string) => formatReportValue('money', value, format);
  const count = (value: number) => formatReportValue('count', value, format);
  const period =
    scope.query.dateFrom === scope.query.dateTo
      ? formatReportValue('date', scope.query.dateFrom, format)
      : `${formatReportValue('date', scope.query.dateFrom, format)} – ${formatReportValue('date', scope.query.dateTo, format)}`;
  const data = detail.data;

  if (!employeeId)
    return (
      <UnavailableDetail
        open={open}
        onClose={onClose}
        title={copy('Employee performance detail')}
      />
    );

  return (
    <DetailShell
      open={open}
      onClose={onClose}
      title={copy('Employee performance detail')}
      badge={
        data ? (
          <DBadge variant={data.employee.currentStatus === 'ACTIVE' ? 'success' : 'secondary'}>
            {copy(data.employee.currentStatus === 'ACTIVE' ? 'Active' : 'Inactive')}
          </DBadge>
        ) : undefined
      }
    >
      {detail.isError ? (
        <DConnectionError
          title={copy('Could not load this employee’s contribution.')}
          message={
            normalizeBackofficeApiError(detail.error, copy('Check the connection and try again.'))
              .safeMessage
          }
          onRetry={() => void detail.refetch()}
          isRetrying={detail.isFetching}
        />
      ) : !data ? (
        <EmployeeDetailSkeleton label={copy('Loading contribution…')} />
      ) : (
        <>
          <RecordPanel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold tracking-tight text-[var(--color-text)]">
                  {data.employee.displayName}
                </h2>
                <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">
                  <span className="font-mono text-xs">{data.employee.code}</span>
                  {data.employee.currentPositionName
                    ? ` · ${copy('Current position')}: ${data.employee.currentPositionName}`
                    : ''}
                </p>
                <p className="mt-2 break-words text-xs text-[var(--color-text-muted)]">
                  {period} · {scope.locationName ?? copy('All locations')}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <RecordSectionLabel>{copy('Contribution revenue')}</RecordSectionLabel>
                <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
                  {money(data.summary.contributionRevenue)}
                </p>
              </div>
            </div>
          </RecordPanel>

          <section aria-label={copy('Summary')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <RecordInfoTile
              label={copy('Transactions')}
              value={count(data.summary.contributedTransactions)}
            />
            <RecordInfoTile
              label={copy('Items worked')}
              value={count(data.summary.contributedLineItems)}
            />
            <RecordInfoTile
              label={copy('Average per transaction')}
              value={money(data.summary.averageContributionPerTransaction)}
            />
            {/* The rank of the ranking row that was opened: no second, competing calculation. */}
            <RecordInfoTile
              label={copy('Rank in this period')}
              value={row.rank === null || row.rank === undefined ? null : `#${row.rank}`}
            />
          </section>

          {data.trend.length >= 2 ? <ContributionTrend trend={data.trend} /> : null}
          <ServiceBreakdown services={data.services} />
          <ContributionRecords
            records={data.records}
            loading={detail.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </DetailShell>
  );
}

/** Holds the dialog near its loaded shape: summary, KPI tiles, and the first card. */
function EmployeeDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <DSkeleton height={112} rounded="lg" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <DSkeleton key={tile} height={64} rounded="lg" />
        ))}
      </div>
      <DSkeleton height={160} rounded="lg" />
    </div>
  );
}

/** Daily contribution as quiet columns; the exact amounts stay available to assistive tech. */
function ContributionTrend({ trend }: { trend: EmployeeContributionDetail['trend'] }) {
  const { copy, format } = useReportingLocalization();
  const max = Math.max(...trend.map((point) => Number(point.value)), 0);
  const day = (label: string) => formatReportValue('date', label, format);
  const money = (value: string) => formatReportValue('money', value, format);
  return (
    <RecordPanel padded={false} ariaLabel={copy('Contribution trend')}>
      <RecordPanelHeader title={copy('Contribution trend')} />
      <RecordPanelBody>
        <div className="flex h-24 items-end gap-1" aria-hidden="true">
          {trend.map((point) => (
            <div
              key={point.label}
              title={`${day(point.label)}: ${money(point.value)}`}
              className="min-w-[3px] flex-1 rounded-t-sm bg-[var(--color-brand)] opacity-80"
              style={{ height: `${max > 0 ? Math.max(4, (Number(point.value) / max) * 100) : 4}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] text-[var(--color-text-muted)]">
          <span>{day(trend[0]!.label)}</span>
          <span>{day(trend.at(-1)!.label)}</span>
        </div>
        <table className="sr-only">
          <caption>{copy('Contribution trend')}</caption>
          <tbody>
            {trend.map((point) => (
              <tr key={point.label}>
                <th scope="row">{day(point.label)}</th>
                <td>{money(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </RecordPanelBody>
    </RecordPanel>
  );
}

/** Contribution per Service, split into the Service's own work and its additional items. */
function ServiceBreakdown({ services }: { services: EmployeeContributionDetail['services'] }) {
  const { copy, format } = useReportingLocalization();
  const money = (value: string) => formatReportValue('money', value, format);
  const count = (value: number) => formatReportValue('count', value, format);
  return (
    <RecordPanel padded={false} ariaLabel={copy('Contribution by service')}>
      <RecordPanelHeader title={copy('Contribution by service')} count={services.length} />
      <RecordPanelBody>
        {services.length ? (
          <ul className="divide-y divide-[var(--color-border)]">
            {services.map((service) => (
              <li key={service.label} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-[var(--color-text)]">
                      {service.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {count(service.transactionCount)} {copy('transactions')} ·{' '}
                      {count(service.workItemCount)} {copy('work items')}
                      {service.share ? ` · ${shareText(service.share, format.numberLocale)}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {money(service.amount)}
                  </p>
                </div>
                {service.share ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-brand)]"
                      style={{ width: `${Math.min(100, Number(service.share) * 100)}%` }}
                    />
                  </div>
                ) : null}
                <dl className="mt-2 space-y-1 text-xs">
                  {/^-?0(\.0+)?$/.test(service.baseAmount) ? null : (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--color-text-muted)]">{copy('Main service')}</dt>
                      <dd className="shrink-0 tabular-nums">{money(service.baseAmount)}</dd>
                    </div>
                  )}
                  {service.additional.map((item) => (
                    <div key={item.label} className="flex justify-between gap-3">
                      <dt className="min-w-0 break-words text-[var(--color-text-muted)]">
                        {copy('Additional item')} · {item.label}
                      </dt>
                      <dd className="shrink-0 tabular-nums">{money(item.amount)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('No contribution was recorded in this period.')}
          </p>
        )}
      </RecordPanelBody>
    </RecordPanel>
  );
}

function ContributionRecords({
  records,
  loading,
  onPageChange,
}: {
  records: EmployeeContributionDetail['records'];
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const { copy, format } = useReportingLocalization();
  const columns: TableColumn<ContributionRecord>[] = [
    {
      key: 'occurredAt',
      label: copy('Date'),
      render: (record) => formatReportValue('datetime', record.occurredAt, format),
    },
    {
      key: 'saleNumber',
      label: copy('Transaction'),
      render: (record) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-mono text-xs font-semibold">
            {record.saleNumber ?? '—'}
          </p>
          <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">
            {record.sellingLocation}
          </p>
        </div>
      ),
    },
    {
      key: 'serviceName',
      label: copy('Work'),
      render: (record) => (
        <div className="min-w-0">
          <p className="break-words">
            {record.serviceName}
            {record.serviceVariantName ? (
              <span className="text-[var(--color-text-muted)]"> · {record.serviceVariantName}</span>
            ) : null}
          </p>
          <p className="mt-0.5 break-words text-xs text-[var(--color-text-muted)]">
            {record.source === 'BASE_SERVICE'
              ? copy('Main service')
              : `${copy('Additional item')} · ${[record.componentName, record.componentVariantName].filter(Boolean).join(' · ')}`}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      label: copy('Contribution'),
      align: 'right',
      render: (record) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatReportValue('money', record.amount, format)}
        </span>
      ),
    },
  ];
  return (
    <RecordPanel padded={false} ariaLabel={copy('Contribution records')}>
      <RecordPanelHeader title={copy('Contribution records')} count={records.total} />
      <RecordPanelBody>
        <DDataTable
          rowKey={(record, index) => `${record.saleId}-${record.source}-${index}`}
          data={records.items}
          columns={columns}
          loading={loading}
          emptyMessage={copy('No contribution was recorded in this period.')}
          pagination={{ page: records.page, pageSize: records.pageSize, total: records.total }}
          onPageChange={onPageChange}
        />
      </RecordPanelBody>
    </RecordPanel>
  );
}
