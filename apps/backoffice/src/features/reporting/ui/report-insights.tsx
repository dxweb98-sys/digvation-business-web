import { DDataTable, type TableColumn } from '@digvation/ui';
import { ChartNoAxesColumnIncreasing, CircleDollarSign, Hash, PackageCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  AnalyticsDonutChart,
  AnalyticsHorizontalBarChart,
  AnalyticsLineChart,
} from '../../../components/analytics/analytics-charts';
import { AnalyticsKpiCard } from '../../../components/analytics/analytics-kpi-card';
import type {
  ComponentUsagePoint,
  ReportDataset,
  ReportPoint,
  ReportQuery,
} from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import type { ReportBreakdown, ReportDefinition, ReportKpi } from '../model/report-catalog';
import { enumLabel, formatReportValue } from '../model/report-format';

const KPI_ICON: Record<ReportKpi['kind'], typeof Hash> = {
  money: CircleDollarSign,
  signedMoney: CircleDollarSign,
  count: Hash,
  quantity: PackageCheck,
};

/** Even rows: six metrics read as two rows of three, five as one row. */
const KPI_COLUMNS: Record<number, string> = {
  3: 'xl:grid-cols-3',
  5: 'xl:grid-cols-5',
  6: 'xl:grid-cols-3',
};

const hasActivity = (points: readonly ReportPoint[] | undefined) =>
  Boolean(points?.some((point) => Number(point.value) !== 0 || (point.count ?? 0) > 0));

/** KPIs, then analytics: only metrics and charts the projection actually returned. */
export function ReportInsights({
  definition,
  data,
  period,
}: {
  definition: ReportDefinition;
  data: ReportDataset | undefined;
  period: ReportQuery;
}) {
  const { copy, format } = useReportingLocalization();
  if (!data) return null;
  const kpis = definition.kpis.filter(
    (kpi) => data.summary[kpi.key] !== undefined && data.summary[kpi.key] !== null,
  );
  const { analytics } = definition;
  const money = (value: string) => formatReportValue('money', value, format);
  const valueOf = (kind: 'money' | 'count' | 'quantity') => (value: string) =>
    formatReportValue(kind, value, format);
  const breakdownPoints = (breakdown: ReportBreakdown) => {
    const raw =
      breakdown.key === 'primary'
        ? (data.analytics.breakdowns?.primary ?? data.analytics.breakdown)
        : (data.analytics.breakdowns?.[breakdown.key] ?? []);
    return raw.map((point) => ({
      label: breakdown.enum ? enumLabel(breakdown.enum, point.label, copy) : point.label,
      value: point.value,
      // The donut sizes slices by `count` when present; money mixes are sized by value.
      ...(breakdown.measure === 'count' ? { count: point.count ?? Number(point.value) } : {}),
    }));
  };
  const trend = analytics.trend && hasActivity(data.analytics.trend) ? analytics.trend : null;
  const donuts = (analytics.breakdowns ?? [])
    .map((breakdown) => ({ breakdown, points: breakdownPoints(breakdown) }))
    .filter(({ points }) => hasActivity(points));
  const ranking =
    analytics.ranking && hasActivity(data.analytics.ranking) ? analytics.ranking : null;
  const usage = analytics.usageByComponent
    ? (data.analytics.breakdown as ComponentUsagePoint[]).filter((point) => point.label)
    : [];
  const empty = copy('No analytics data is available for this period.');
  const donutCards = donuts.map(({ breakdown, points }) => (
    <AnalyticsDonutChart
      key={breakdown.key}
      title={copy(breakdown.title)}
      data={points}
      emptyMessage={empty}
      totalLabel={copy('Total')}
      formatValue={(value) =>
        breakdown.measure === 'count'
          ? formatReportValue('count', String(value), format)
          : money(String(value))
      }
    />
  ));

  return (
    <>
      {kpis.length ? (
        <section
          aria-label={copy('Summary')}
          className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${KPI_COLUMNS[kpis.length] ?? 'xl:grid-cols-4'}`}
        >
          {kpis.map((kpi) => {
            const Icon = KPI_ICON[kpi.kind];
            return (
              <AnalyticsKpiCard
                key={kpi.key}
                label={copy(kpi.label)}
                value={formatReportValue(kpi.kind, data.summary[kpi.key], format)}
                icon={
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                }
              />
            );
          })}
        </section>
      ) : null}

      {trend ? (
        <AnalyticsRow>
          <AnalyticsLineChart
            title={copy(trend.title)}
            subtitle={`${copy('Selected period')}: ${formatReportValue('date', period.dateFrom, format)} — ${formatReportValue('date', period.dateTo, format)}`}
            data={data.analytics.trend}
            formatValue={valueOf(trend.kind)}
            emptyMessage={empty}
            pointsLabel={copy('data points')}
          />
          {donutCards.length ? (
            <div className="grid min-w-0 content-start gap-4">{donutCards}</div>
          ) : null}
        </AnalyticsRow>
      ) : donutCards.length || ranking ? (
        <AnalyticsRow>
          {ranking ? (
            <AnalyticsHorizontalBarChart
              title={copy(ranking.title)}
              data={data.analytics.ranking}
              formatValue={valueOf(ranking.kind)}
              emptyMessage={empty}
            />
          ) : null}
          {donutCards}
        </AnalyticsRow>
      ) : null}

      {trend && ranking ? (
        <AnalyticsRow>
          <AnalyticsHorizontalBarChart
            title={copy(ranking.title)}
            data={data.analytics.ranking}
            formatValue={valueOf(ranking.kind)}
            emptyMessage={empty}
          />
        </AnalyticsRow>
      ) : null}

      {usage.length ? <UsageByComponent points={usage} /> : null}
    </>
  );
}

function AnalyticsRow({ children }: { children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">{children}</section>
  );
}

/** The component usage aggregate: total, configured/selected split, billed part, and services. */
function UsageByComponent({ points }: { points: readonly ComponentUsagePoint[] }) {
  const { copy, format } = useReportingLocalization();
  const quantity = (value: string | undefined) =>
    formatReportValue('quantity', value ?? '0', format);
  const columns: TableColumn<ComponentUsagePoint>[] = [
    { key: 'label', label: copy('Component') },
    {
      key: 'value',
      label: copy('Total used'),
      align: 'right',
      render: (point) => quantity(point.value),
    },
    {
      key: 'fixedQuantity',
      label: copy('Configured'),
      align: 'right',
      render: (point) => quantity(point.fixedQuantity),
    },
    {
      key: 'selectedQuantity',
      label: copy('Selected'),
      align: 'right',
      render: (point) => quantity(point.selectedQuantity),
    },
    {
      key: 'billedAmount',
      label: copy('Billed amount'),
      align: 'right',
      render: (point) =>
        point.billedAmount && Number(point.billedAmount) > 0
          ? formatReportValue('money', point.billedAmount, format)
          : '—',
    },
    {
      key: 'count',
      label: copy('Transactions'),
      align: 'right',
      render: (point) => formatReportValue('count', String(point.count ?? 0), format),
    },
    {
      key: 'services',
      label: copy('Used by service'),
      render: (point) =>
        point.services
          ?.map((service) => `${service.label} ${quantity(service.quantity)}`)
          .join(' · ') ?? '—',
    },
  ];
  return (
    <section aria-label={copy('Usage by component')} className="space-y-3">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <ChartNoAxesColumnIncreasing
            aria-hidden="true"
            className="size-4 text-[var(--color-brand)]"
          />
          {copy('Usage by component')}
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {copy(
            'Quantities recorded at the time of each transaction. Billed amounts are part of the sold line, not extra revenue or cost.',
          )}
        </p>
      </header>
      <DDataTable
        rowKey={(point) => point.label}
        data={[...points]}
        columns={columns}
        emptyMessage={copy('No report data is available for this period.')}
      />
    </section>
  );
}
