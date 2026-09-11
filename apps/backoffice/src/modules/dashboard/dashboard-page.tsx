import { useRuntime } from '@digvation/business-runtime';
import { DCard, DSelect } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  Hash,
  PackageCheck,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  BackofficePage,
  BackofficePageHeader,
} from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BusinessInsightWidget } from './components/business-insight-widget';
import { BusinessPerformanceCard } from './components/business-performance-card';
import { DashboardConfigurator } from './components/dashboard-configurator';
import { DashboardKpiCard } from './components/dashboard-kpi-card';
import { PaymentMixCard } from './components/payment-mix-card';
import { RankingCard } from './components/ranking-card';
import { TransactionsCard } from './components/transactions-card';
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
  DashboardFilterState,
  DashboardRow,
  DashboardWidgetId,
} from './dashboard.types';

const DAY_MS = 86_400_000;
type ActivityPeriod = 'today' | '7d' | 'month' | 'year';

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodRange(period: ActivityPeriod, date = new Date()) {
  const to = localDateKey(date);
  if (period === 'today') return { from: to, to };
  if (period === '7d') {
    const from = new Date(date);
    from.setDate(from.getDate() - 6);
    return { from: localDateKey(from), to };
  }
  if (period === 'month') {
    return {
      from: localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
      to,
    };
  }
  return {
    from: localDateKey(new Date(date.getFullYear(), 0, 1)),
    to,
  };
}

function recentRange(days: number, date = new Date()) {
  const to = localDateKey(date);
  const from = new Date(date);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return { from: localDateKey(from), to };
}

function previousRange(
  from: string,
  to: string,
): Pick<DashboardFilterState, 'from' | 'to'> {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  const spanDays = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const previousEnd = new Date(start - DAY_MS);
  const previousStart = new Date(
    previousEnd.getTime() - (spanDays - 1) * DAY_MS,
  );
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

function numberValue(value: DashboardRow[string] | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function loadLocationPreference(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? null : value;
  } catch {
    return null;
  }
}

function saveLocationPreference(key: string, locationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, locationId);
  } catch {
    // Dashboard location is convenience state only.
  }
}

export function DashboardPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatMoney } = useBackofficeLocalization();
  const [activityPeriod, setActivityPeriod] =
    useState<ActivityPeriod>('month');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
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
    : 'digvation.backoffice.dashboard.widgets.v3:anonymous';
  const locationPreferenceKey = session
    ? `digvation.backoffice.dashboard.location.v1:${session.identity.workspace}:${session.identity.userId}`
    : 'digvation.backoffice.dashboard.location.v1:anonymous';
  const [enabledWidgets, setEnabledWidgets] = useState<DashboardWidgetId[]>(() =>
    loadDashboardPreferences(preferenceKey),
  );

  useEffect(() => {
    setEnabledWidgets(loadDashboardPreferences(preferenceKey));
  }, [preferenceKey]);

  useEffect(() => {
    setSelectedLocationId(loadLocationPreference(locationPreferenceKey));
  }, [locationPreferenceKey]);

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

  const accessibleLocationIds = useMemo(
    () => new Set((locations.data?.locations ?? []).map((location) => location.id)),
    [locations.data?.locations],
  );
  const explicitLocationIsValid =
    selectedLocationId !== null &&
    accessibleLocationIds.has(selectedLocationId);
  const defaultLocationId =
    locations.data?.mainLocationId ??
    (locations.data?.resolution === 'AUTO_RESOLVED'
      ? (locations.data.selectedLocationId ?? '')
      : '');
  const locationId = explicitLocationIsValid
    ? (selectedLocationId ?? '')
    : defaultLocationId;
  const locationReady = Boolean(
    locations.data &&
      locations.data.resolution !== 'DENIED' &&
      locationId &&
      accessibleLocationIds.has(locationId),
  );

  const today = periodRange('today');
  const yesterday = previousRange(today.from, today.to);
  const month = periodRange('month');
  const previousMonth = previousRange(month.from, month.to);
  const activity = periodRange(activityPeriod);
  const previousActivity = previousRange(activity.from, activity.to);
  const recent = recentRange(30);

  const todayFilters: DashboardFilterState = { ...today, locationId };
  const yesterdayFilters: DashboardFilterState = { ...yesterday, locationId };
  const monthFilters: DashboardFilterState = { ...month, locationId };
  const previousMonthFilters: DashboardFilterState = {
    ...previousMonth,
    locationId,
  };
  const activityFilters: DashboardFilterState = { ...activity, locationId };
  const previousActivityFilters: DashboardFilterState = {
    ...previousActivity,
    locationId,
  };
  const recentFilters: DashboardFilterState = { ...recent, locationId };

  const canReadSales = permissions.includes('sales:read');
  const canReadCatalog = permissions.includes('catalog:read');
  const canReadEmployees = permissions.includes('employees:read');
  const canReadLocations = permissions.includes('locations:read');

  const todayPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', todayFilters],
    queryFn: () => api.report('business-performance', todayFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const yesterdayPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', yesterdayFilters],
    queryFn: () => api.report('business-performance', yesterdayFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const activityPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', activityFilters],
    queryFn: () => api.report('business-performance', activityFilters),
    enabled: Boolean(
      session && canReadSales && locationReady && widgetEnabled('businessPerformance'),
    ),
  });
  const previousActivityPerformance = useQuery({
    queryKey: [
      'dashboard',
      'business-performance',
      'previous-activity',
      previousActivityFilters,
    ],
    queryFn: () => api.report('business-performance', previousActivityFilters),
    enabled: Boolean(
      session && canReadSales && locationReady && widgetEnabled('businessPerformance'),
    ),
  });
  const monthPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', monthFilters],
    queryFn: () => api.report('business-performance', monthFilters),
    enabled: Boolean(
      session &&
        canReadSales &&
        locationReady &&
        (widgetEnabled('paymentMix') || widgetEnabled('businessInsight')),
    ),
  });
  const previousMonthPerformance = useQuery({
    queryKey: [
      'dashboard',
      'business-performance',
      'previous-month',
      previousMonthFilters,
    ],
    queryFn: () => api.report('business-performance', previousMonthFilters),
    enabled: Boolean(
      session && canReadSales && locationReady && widgetEnabled('businessInsight'),
    ),
  });
  const lastTransactions = useQuery({
    queryKey: ['dashboard', 'last-transactions', recentFilters],
    queryFn: () => api.report('transactions', recentFilters, 6),
    enabled: Boolean(
      session && canReadSales && locationReady && widgetEnabled('lastTransactions'),
    ),
  });
  const catalogPerformance = useQuery({
    queryKey: ['dashboard', 'catalog-performance', monthFilters],
    queryFn: () => api.report('catalog-performance', monthFilters, 5),
    enabled: Boolean(
      session && canReadCatalog && locationReady && widgetEnabled('topItems'),
    ),
  });
  const employeePerformance = useQuery({
    queryKey: ['dashboard', 'employee-performance', monthFilters],
    queryFn: () => api.report('employee-performance', monthFilters, 5),
    enabled: Boolean(
      session && canReadEmployees && locationReady && widgetEnabled('topEmployees'),
    ),
  });
  const locationPerformance = useQuery({
    queryKey: ['dashboard', 'locations', monthFilters],
    queryFn: () => api.report('locations', monthFilters, 8),
    enabled: Boolean(
      session && canReadLocations && locationReady && widgetEnabled('locationPerformance'),
    ),
  });

  if (!session) return null;

  const updateWidgets = (next: DashboardWidgetId[]) => {
    setEnabledWidgets(next);
    saveDashboardPreferences(preferenceKey, next);
  };
  const defaultWidgets = DEFAULT_DASHBOARD_WIDGETS.filter((id) =>
    availableIds.has(id),
  );

  const selectLocation = (value: unknown) => {
    const next = String(value ?? '');
    if (!accessibleLocationIds.has(next)) return;
    setSelectedLocationId(next);
    saveLocationPreference(locationPreferenceKey, next);
  };

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
  const moneyNumber = (value: number) =>
    formatMoney(String(value), runtime.currency);
  const empty = copy('No summary data is available for this month.');

  const todayData = todayPerformance.data;
  const yesterdayData = yesterdayPerformance.data;
  const activityData = activityPerformance.data;
  const previousActivityData = previousActivityPerformance.data;
  const monthData = monthPerformance.data;
  const previousMonthData = previousMonthPerformance.data;

  const revenueToday = numberValue(todayData?.summary.finalRevenue);
  const revenueYesterday = numberValue(yesterdayData?.summary.finalRevenue);
  const transactionsToday = numberValue(todayData?.summary.transactionCount);
  const transactionsYesterday = numberValue(yesterdayData?.summary.transactionCount);
  const averageToday = numberValue(todayData?.summary.averageTransactionValue);
  const averageYesterday = numberValue(yesterdayData?.summary.averageTransactionValue);
  const quantityToday = numberValue(todayData?.summary.quantitySold);
  const quantityYesterday = numberValue(yesterdayData?.summary.quantitySold);

  const activityRevenue = numberValue(activityData?.summary.finalRevenue);
  const previousActivityRevenue = numberValue(
    previousActivityData?.summary.finalRevenue,
  );
  const activityTransactions = numberValue(activityData?.summary.transactionCount);
  const previousActivityTransactions = numberValue(
    previousActivityData?.summary.transactionCount,
  );

  const paymentMix =
    monthData?.analytics.breakdowns?.paymentMethod ??
    monthData?.analytics.breakdown ??
    [];
  const recentTransactions = lastTransactions.data?.items ?? [];

  const topItems = (catalogPerformance.data?.items ?? [])
    .slice(0, 5)
    .map((row) => ({
      label: String(row.itemName ?? '—'),
      secondary: `${formatInteger(numberValue(row.quantitySold))} sold · ${formatInteger(numberValue(row.transactionCount))} tx`,
      value: money(row.finalRevenue),
    }));
  const topEmployees = (employeePerformance.data?.items ?? [])
    .slice(0, 5)
    .map((row) => ({
      label: String(row.employeeName ?? '—'),
      secondary: `${formatInteger(numberValue(row.contributedTransactions))} tx · ${String(row.topCatalogItem ?? '—')}`,
      value: money(row.contributionRevenue),
    }));
  const topLocations = (locationPerformance.data?.items ?? [])
    .slice(0, 8)
    .map((row) => ({
      label: String(row.locationName ?? '—'),
      secondary: `${formatInteger(numberValue(row.transactionCount))} tx`,
      value: money(row.finalRevenue),
    }));

  const locationOptions = [...(locations.data?.locations ?? [])].sort(
    (left, right) => {
      if (left.id === locations.data?.mainLocationId) return -1;
      if (right.id === locations.data?.mainLocationId) return 1;
      return (left.name ?? left.displayName ?? left.code).localeCompare(
        right.name ?? right.displayName ?? right.code,
      );
    },
  );

  const headerAction = premium ? (
    <DashboardConfigurator
      widgets={availableWidgets}
      enabled={enabledWidgets}
      defaults={defaultWidgets}
      open={configOpen}
      onOpenChange={setConfigOpen}
      onSave={updateWidgets}
    />
  ) : undefined;

  const optionalSummaryVisible =
    widgetEnabled('topItems') || widgetEnabled('topEmployees');
  const secondarySummaryVisible =
    widgetEnabled('paymentMix') || widgetEnabled('locationPerformance');

  return (
    <BackofficePage>
      <div className="pt-2">
        <BackofficePageHeader
          eyebrow={copy('Overview')}
          title={copy('Dashboard')}
          description={copy(
            premium
              ? 'A concise daily business pulse with configurable summaries.'
              : 'A concise daily business pulse from your permitted business data.',
          )}
          actions={headerAction}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:max-w-xl">
        <DSelect
          label={copy('Location')}
          value={locationId}
          options={locationOptions.map((location) => ({
            value: location.id,
            label: `${location.name ?? location.displayName ?? location.code}${
              location.id === locations.data?.mainLocationId
                ? ` · ${copy('Main Branch')}`
                : ''
            }`,
          }))}
          onChange={selectLocation}
        />
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {premium
            ? copy('PRO dashboard · Main Branch is used by default.')
            : copy('Standard dashboard · Main Branch is used by default.')}
        </p>
      </div>

      {!canReadSales ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">
            {copy('Sales reporting unavailable')}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy(
              'Your role does not include permission to read sales summary data.',
            )}
          </p>
        </DCard>
      ) : null}

      {locations.data && !locationReady ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">{copy('Select a location')}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy(
              'Choose one authorized branch before loading dashboard summaries.',
            )}
          </p>
        </DCard>
      ) : null}

      {canReadSales && locationReady ? (
        <>
          <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              label={copy('Revenue today')}
              value={money(todayData?.summary.finalRevenue)}
              context={copy('Compared with yesterday')}
              delta={percentageChange(revenueToday, revenueYesterday)}
              emphasis
              icon={
                <CircleDollarSign aria-hidden="true" className="size-4" />
              }
            />
            <DashboardKpiCard
              label={copy('Transactions today')}
              value={formatInteger(transactionsToday)}
              context={copy('Compared with yesterday')}
              delta={percentageChange(
                transactionsToday,
                transactionsYesterday,
              )}
              icon={<ReceiptText aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Average transaction today')}
              value={money(todayData?.summary.averageTransactionValue)}
              context={copy('Compared with yesterday')}
              delta={percentageChange(averageToday, averageYesterday)}
              icon={<Hash aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Quantity sold today')}
              value={formatInteger(quantityToday)}
              context={copy('Compared with yesterday')}
              delta={percentageChange(quantityToday, quantityYesterday)}
              icon={<PackageCheck aria-hidden="true" className="size-4" />}
            />
          </section>

          {premium &&
          (widgetEnabled('businessPerformance') ||
            widgetEnabled('lastTransactions')) ? (
            <section
              className={[
                'mt-5 grid gap-4',
                widgetEnabled('businessPerformance') &&
                widgetEnabled('lastTransactions')
                  ? 'lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]'
                  : 'grid-cols-1',
              ].join(' ')}
            >
              {widgetEnabled('businessPerformance') ? (
                <BusinessPerformanceCard
                  title={copy('Transaction activity')}
                  period={activityPeriod}
                  periodOptions={[
                    { value: 'today', label: copy('Today') },
                    { value: '7d', label: copy('Last 7 days') },
                    { value: 'month', label: copy('This month') },
                    { value: 'year', label: copy('This year') },
                  ]}
                  onPeriodChange={(value) =>
                    setActivityPeriod(value as ActivityPeriod)
                  }
                  revenue={activityRevenue}
                  transactions={activityTransactions}
                  previousRevenue={previousActivityRevenue}
                  previousTransactions={previousActivityTransactions}
                  trend={activityData?.analytics.trend ?? []}
                  formatMoney={moneyNumber}
                />
              ) : null}

              {widgetEnabled('lastTransactions') ? (
                <TransactionsCard
                  title={copy('Last transactions')}
                  periodLabel={copy('Last 30 days')}
                  total={lastTransactions.data?.total ?? 0}
                  transactions={recentTransactions}
                  emptyMessage={copy(
                    'No transactions have been recorded in the last 30 days.',
                  )}
                  formatDateTime={formatDateTime}
                  formatMoney={money}
                />
              ) : null}
            </section>
          ) : null}

          {premium && optionalSummaryVisible ? (
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {widgetEnabled('topItems') ? (
                <RankingCard
                  title={copy('Top 5 items')}
                  subtitle={copy('This month')}
                  items={topItems}
                  emptyMessage={empty}
                />
              ) : null}
              {widgetEnabled('topEmployees') ? (
                <RankingCard
                  title={copy('Top 5 employees')}
                  subtitle={copy('This month')}
                  items={topEmployees}
                  emptyMessage={empty}
                />
              ) : null}
            </section>
          ) : null}

          {premium && secondarySummaryVisible ? (
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {widgetEnabled('paymentMix') ? (
                <PaymentMixCard
                  title={copy('Payment mix · This month')}
                  points={paymentMix}
                  emptyMessage={empty}
                  formatValue={moneyNumber}
                />
              ) : null}
              {widgetEnabled('locationPerformance') ? (
                <RankingCard
                  title={copy('Location performance')}
                  subtitle={copy('This month')}
                  items={topLocations}
                  emptyMessage={empty}
                />
              ) : null}
            </section>
          ) : null}

          {premium && widgetEnabled('businessInsight') ? (
            <section className="mt-4">
              <BusinessInsightWidget
                current={monthData}
                previous={previousMonthData}
                currency={runtime.currency}
                formatMoney={formatMoney}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </BackofficePage>
  );
}
