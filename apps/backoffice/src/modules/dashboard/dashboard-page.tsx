import { useRuntime } from '@digvation/business-runtime';
import { DCard, DDateRangeFilter, DSelect } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  Hash,
  PackageCheck,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  AnalyticsDonutChart,
  AnalyticsHorizontalBarChart,
  AnalyticsLineChart,
} from '../../components/analytics/analytics-charts';
import { AnalyticsKpiCard } from '../../components/analytics/analytics-kpi-card';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BusinessInsightWidget } from './components/business-insight-widget';
import { DashboardConfigurator } from './components/dashboard-configurator';
import { DashboardApi } from './dashboard-api';
import {
  dashboardPreferenceKey,
  loadDashboardPreferences,
  saveDashboardPreferences,
} from './dashboard-preferences';
import {
  availableDashboardWidgets,
  DEFAULT_DASHBOARD_WIDGETS,
} from './dashboard-widget-registry';
import type {
  DashboardDataset,
  DashboardFilterState,
  DashboardRow,
  DashboardWidgetId,
} from './dashboard.types';

const DAY_MS = 86_400_000;

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousRange(from: string, to: string): Pick<DashboardFilterState, 'from' | 'to'> {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const spanDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const previousEnd = new Date(start - DAY_MS);
  const previousStart = new Date(previousEnd.getTime() - (spanDays - 1) * DAY_MS);
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

function numberValue(value: DashboardRow[string] | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DashboardPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatMoney } = useBackofficeLocalization();
  const today = localDateKey();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [configOpen, setConfigOpen] = useState(false);

  const api = useMemo(
    () => new DashboardApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const permissions = session?.identity.permissions ?? [];
  const premium = Boolean(
    session?.effectiveEntitlements.capabilities.includes('BUSINESS_ANALYTICS'),
  );
  const preferenceKey = session
    ? dashboardPreferenceKey({
        workspace: session.identity.workspace,
        userId: session.identity.userId,
      })
    : 'digvation.backoffice.dashboard.widgets:anonymous';
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetId[]>(() =>
    loadDashboardPreferences(preferenceKey),
  );

  useEffect(() => {
    setEnabledWidgets(loadDashboardPreferences(preferenceKey));
  }, [preferenceKey]);

  const availableWidgets = useMemo(
    () => availableDashboardWidgets(permissions),
    [permissions],
  );
  const availableIds = useMemo(
    () => new Set(availableWidgets.map(({ id }) => id)),
    [availableWidgets],
  );
  const widgetEnabled = (id: DashboardWidgetId) =>
    premium && availableIds.has(id) && enabledWidgets.includes(id);

  const locations = useQuery({
    queryKey: ['dashboard', 'operational-access'],
    queryFn: () => api.operationalAccess(),
    enabled: Boolean(session),
  });
  const locationId =
    selectedLocationId ||
    (locations.data?.resolution === 'AUTO_RESOLVED'
      ? (locations.data.selectedLocationId ?? '')
      : '');
  const locationReady =
    locations.data?.resolution !== 'SELECTION_REQUIRED' || Boolean(locationId);
  const filters: DashboardFilterState = { from, to, locationId };
  const todayFilters: DashboardFilterState = {
    from: today,
    to: today,
    locationId,
  };
  const canReadSales = permissions.includes('sales:read');
  const canReadCatalog = permissions.includes('catalog:read');
  const canReadEmployees = permissions.includes('employees:read');

  const performance = useQuery({
    queryKey: ['dashboard', 'business-performance', filters],
    queryFn: () => api.report('business-performance', filters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const todayTransactions = useQuery({
    queryKey: ['dashboard', 'today-transactions', todayFilters],
    queryFn: () => api.report('transactions', todayFilters, 6),
    enabled: Boolean(session && canReadSales && locationReady),
  });

  const previous = previousRange(from, to);
  const previousFilters: DashboardFilterState = {
    ...previous,
    locationId,
  };
  const previousPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', 'previous', previousFilters],
    queryFn: () => api.report('business-performance', previousFilters),
    enabled: Boolean(
      session &&
        canReadSales &&
        locationReady &&
        widgetEnabled('businessInsight'),
    ),
  });
  const catalogPerformance = useQuery({
    queryKey: ['dashboard', 'catalog-performance', filters],
    queryFn: () => api.report('catalog-performance', filters, 5),
    enabled: Boolean(
      session &&
        canReadCatalog &&
        locationReady &&
        widgetEnabled('topItems'),
    ),
  });
  const employeePerformance = useQuery({
    queryKey: ['dashboard', 'employee-performance', filters],
    queryFn: () => api.report('employee-performance', filters, 5),
    enabled: Boolean(
      session &&
        canReadEmployees &&
        locationReady &&
        widgetEnabled('topEmployees'),
    ),
  });

  if (!session) return null;

  const updateWidgets = (next: DashboardWidgetId[]) => {
    setEnabledWidgets(next);
    saveDashboardPreferences(preferenceKey, next);
  };
  const toggleWidget = (id: DashboardWidgetId) => {
    updateWidgets(
      enabledWidgets.includes(id)
        ? enabledWidgets.filter((candidate) => candidate !== id)
        : [...enabledWidgets, id],
    );
  };
  const resetWidgets = () =>
    updateWidgets(
      DEFAULT_DASHBOARD_WIDGETS.filter((id) => availableIds.has(id)),
    );

  const formatInteger = (value: number | string) =>
    new Intl.NumberFormat('id-ID').format(Number(value) || 0);
  const formatDateTime = (value: DashboardRow[string] | undefined) => {
    if (typeof value !== 'string') return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(runtime.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };
  const money = (value: DashboardRow[string] | undefined) =>
    formatMoney(String(value ?? 0), runtime.currency);
  const empty = copy('No analytics data is available for this period.');
  const data = performance.data;
  const paymentMix =
    data?.analytics.breakdowns?.paymentMethod ?? data?.analytics.breakdown ?? [];
  const topItems = (catalogPerformance.data?.analytics.ranking ?? []).slice(0, 5);
  const topEmployees = (employeePerformance.data?.analytics.ranking ?? []).slice(0, 5);
  const locationPerformance = (data?.analytics.ranking ?? []).slice(0, 8);
  const transactions = todayTransactions.data?.items ?? [];

  const headerAction = premium ? (
    <DashboardConfigurator
      widgets={availableWidgets}
      enabled={enabledWidgets}
      open={configOpen}
      onOpenChange={setConfigOpen}
      onToggle={toggleWidget}
      onReset={resetWidgets}
    />
  ) : undefined;

  return (
    <BackofficePage>
      <div className="pt-2">
        <BackofficePageHeader
          eyebrow={copy('Overview')}
          title={copy('Dashboard')}
          description={copy(
            premium
              ? 'Daily business pulse with configurable analytics from your entitled business data.'
              : 'Daily business pulse from your permitted business data.',
          )}
          actions={headerAction}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 items-end gap-3 md:grid-cols-[360px_260px_auto]">
        <div className="min-w-0">
          <DDateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </div>
        <div className="min-w-0">
          <DSelect
            label={copy('Location')}
            value={locationId}
            options={[
              {
                value: '',
                label: copy(
                  locations.data?.organizationWide
                    ? 'All locations'
                    : 'Select location',
                ),
              },
              ...(locations.data?.locations ?? []).map((location) => ({
                value: location.id,
                label:
                  location.name ?? location.displayName ?? location.code,
              })),
            ]}
            onChange={(value) => setSelectedLocationId(String(value ?? ''))}
          />
        </div>
        <div className="pb-1 text-xs text-[var(--color-text-muted)]">
          {premium ? (
            <span className="inline-flex rounded-full bg-[var(--color-accent-mint)] px-2.5 py-1 font-medium text-[var(--color-text)]">
              Business Analytics enabled
            </span>
          ) : (
            <span>{copy('Standard dashboard')}</span>
          )}
        </div>
      </div>

      {!locationReady ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">{copy('Select a location')}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy('Choose an authorized selling location before loading dashboard data.')}
          </p>
        </DCard>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsKpiCard
          label={copy('Revenue')}
          value={money(data?.summary.finalRevenue)}
          context={`${from} — ${to}`}
          icon={
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-sky)] text-[var(--color-brand)]">
              <CircleDollarSign aria-hidden="true" className="size-4" />
            </span>
          }
        />
        <AnalyticsKpiCard
          label={copy('Transactions')}
          value={formatInteger(numberValue(data?.summary.transactionCount))}
          context={`${from} — ${to}`}
          icon={
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-mint)] text-[var(--color-brand)]">
              <ReceiptText aria-hidden="true" className="size-4" />
            </span>
          }
        />
        <AnalyticsKpiCard
          label={copy('Average transaction')}
          value={money(data?.summary.averageTransactionValue)}
          context={copy('Final revenue per transaction')}
          icon={
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-yellow)] text-[var(--color-brand)]">
              <Hash aria-hidden="true" className="size-4" />
            </span>
          }
        />
        <AnalyticsKpiCard
          label={copy('Quantity sold')}
          value={formatInteger(numberValue(data?.summary.quantitySold))}
          context={copy('Items and services sold')}
          icon={
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-accent-lavender)] text-[var(--color-brand)]">
              <PackageCheck aria-hidden="true" className="size-4" />
            </span>
          }
        />
      </section>

      <section className="mt-5">
        <DCard
          variant="elevated"
          className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_14px_34px_-28px_var(--color-text)] sm:p-6"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                {copy("Today's transactions")}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {copy('Latest sales recorded today. This section always remains on the dashboard.')}
              </p>
            </div>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {formatInteger(todayTransactions.data?.total ?? 0)} {copy('transactions')}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                  <th className="px-2 py-2 font-medium">{copy('Sale')}</th>
                  <th className="px-2 py-2 font-medium">{copy('Time')}</th>
                  <th className="px-2 py-2 font-medium">{copy('Location')}</th>
                  <th className="px-2 py-2 font-medium">{copy('Status')}</th>
                  <th className="px-2 py-2 text-right font-medium">{copy('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length ? (
                  transactions.map((transaction, index) => (
                    <tr
                      key={String(transaction.saleNumber ?? transaction.invoiceNumber ?? index)}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-2 py-3 font-medium">
                        {String(transaction.saleNumber ?? transaction.invoiceNumber ?? '—')}
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-muted)]">
                        {formatDateTime(transaction.occurredAt)}
                      </td>
                      <td className="px-2 py-3 text-[var(--color-text-muted)]">
                        {String(transaction.sellingLocation ?? '—')}
                      </td>
                      <td className="px-2 py-3">
                        <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-xs font-medium">
                          {copy(String(transaction.saleStatus ?? '—'))}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right font-semibold tabular-nums">
                        {money(transaction.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-xs text-[var(--color-text-muted)]"
                    >
                      {copy('No transactions have been recorded today.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DCard>
      </section>

      {premium ? (
        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          {widgetEnabled('salesTrend') ? (
            <AnalyticsLineChart
              title={copy('Sales trend')}
              subtitle={`${copy('Selected period')}: ${from} — ${to}`}
              data={data?.analytics.trend ?? []}
              formatValue={(value) => formatMoney(value, runtime.currency)}
              emptyMessage={empty}
              pointsLabel={copy('data points')}
            />
          ) : null}

          {widgetEnabled('paymentMix') ? (
            <AnalyticsDonutChart
              title={copy('Payment mix')}
              data={paymentMix}
              emptyMessage={empty}
              totalLabel={copy('Total')}
              formatValue={(value) => formatInteger(value)}
            />
          ) : null}

          {widgetEnabled('topItems') ? (
            <AnalyticsHorizontalBarChart
              title={copy('Top 5 items')}
              data={topItems}
              formatValue={(value) => formatMoney(value, runtime.currency)}
              emptyMessage={empty}
            />
          ) : null}

          {widgetEnabled('topEmployees') ? (
            <AnalyticsHorizontalBarChart
              title={copy('Top 5 employees')}
              data={topEmployees}
              formatValue={(value) => formatMoney(value, runtime.currency)}
              emptyMessage={empty}
            />
          ) : null}

          {widgetEnabled('locationPerformance') &&
          locations.data?.locations.length &&
          locationPerformance.length ? (
            <AnalyticsHorizontalBarChart
              title={copy('Location performance')}
              data={locationPerformance}
              formatValue={(value) => formatMoney(value, runtime.currency)}
              emptyMessage={empty}
            />
          ) : null}

          {widgetEnabled('businessInsight') ? (
            <BusinessInsightWidget
              current={data}
              previous={previousPerformance.data}
              formatMoney={formatMoney}
            />
          ) : null}
        </section>
      ) : null}
    </BackofficePage>
  );
}
