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
type PeriodPreset = 'today' | '7d' | 'month' | 'year' | 'custom';

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodRange(preset: Exclude<PeriodPreset, 'custom'>, date = new Date()) {
  const to = localDateKey(date);
  if (preset === 'today') return { from: to, to };
  if (preset === '7d') {
    const from = new Date(date);
    from.setDate(from.getDate() - 6);
    return { from: localDateKey(from), to };
  }
  if (preset === 'month') {
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

export function DashboardPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatMoney } = useBackofficeLocalization();
  const today = localDateKey();
  const initialRange = periodRange('month');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
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
    : 'digvation.backoffice.dashboard.widgets.v2:anonymous';
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
  const canReadLocations = permissions.includes('locations:read');

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
    enabled: Boolean(session && canReadSales && locationReady),
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
  const locationPerformance = useQuery({
    queryKey: ['dashboard', 'locations', filters],
    queryFn: () => api.report('locations', filters, 8),
    enabled: Boolean(
      session &&
        canReadLocations &&
        locationReady &&
        widgetEnabled('locationPerformance'),
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

  const setPreset = (value: string) => {
    const next = value as PeriodPreset;
    setPeriodPreset(next);
    if (next === 'custom') return;
    const range = periodRange(next);
    setFrom(range.from);
    setTo(range.to);
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
  const empty = copy('No analytics data is available for this period.');
  const data = performance.data;
  const previousData = previousPerformance.data;
  const paymentMix =
    data?.analytics.breakdowns?.paymentMethod ?? data?.analytics.breakdown ?? [];
  const transactions = todayTransactions.data?.items ?? [];
  const revenue = numberValue(data?.summary.finalRevenue);
  const previousRevenue = numberValue(previousData?.summary.finalRevenue);
  const transactionCount = numberValue(data?.summary.transactionCount);
  const previousTransactionCount = numberValue(
    previousData?.summary.transactionCount,
  );
  const averageTransaction = numberValue(data?.summary.averageTransactionValue);
  const previousAverageTransaction = numberValue(
    previousData?.summary.averageTransactionValue,
  );
  const quantitySold = numberValue(data?.summary.quantitySold);
  const previousQuantitySold = numberValue(previousData?.summary.quantitySold);

  const topItems = (catalogPerformance.data?.items ?? []).slice(0, 5).map((row) => ({
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

  const periodLabel =
    periodPreset === 'today'
      ? copy('Today')
      : periodPreset === '7d'
        ? copy('Last 7 days')
        : periodPreset === 'month'
          ? copy('This month')
          : periodPreset === 'year'
            ? copy('This year')
            : `${from} — ${to}`;

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

      <div className="mt-5 grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(280px,1fr)_260px_auto]">
        <DSelect
          label={copy('Period')}
          value={periodPreset}
          options={[
            { value: 'today', label: copy('Today') },
            { value: '7d', label: copy('Last 7 days') },
            { value: 'month', label: copy('This month') },
            { value: 'year', label: copy('This year') },
            { value: 'custom', label: copy('Custom range') },
          ]}
          onChange={(value) => setPreset(String(value ?? 'month'))}
        />
        <div className={periodPreset === 'custom' ? 'min-w-0' : 'hidden xl:block'}>
          {periodPreset === 'custom' ? (
            <DDateRangeFilter
              from={from}
              to={to}
              onFromChange={setFrom}
              onToChange={setTo}
            />
          ) : (
            <div className="pb-2 text-xs text-[var(--color-text-muted)]">
              {from} — {to}
            </div>
          )}
        </div>
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
              label: location.name ?? location.displayName ?? location.code,
            })),
          ]}
          onChange={(value) => setSelectedLocationId(String(value ?? ''))}
        />
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

      {!canReadSales ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">{copy('Sales reporting unavailable')}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {copy('Your role does not include permission to read sales reporting data.')}
          </p>
        </DCard>
      ) : null}

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

      {canReadSales && locationReady ? (
        <>
          <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DashboardKpiCard
              label={copy('Revenue')}
              value={money(data?.summary.finalRevenue)}
              context={periodLabel}
              delta={percentageChange(revenue, previousRevenue)}
              emphasis
              icon={<CircleDollarSign aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Transactions')}
              value={formatInteger(transactionCount)}
              context={periodLabel}
              delta={percentageChange(transactionCount, previousTransactionCount)}
              icon={<ReceiptText aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Average transaction')}
              value={money(data?.summary.averageTransactionValue)}
              context={copy('Revenue per transaction')}
              delta={percentageChange(
                averageTransaction,
                previousAverageTransaction,
              )}
              icon={<Hash aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Quantity sold')}
              value={formatInteger(quantitySold)}
              context={copy('Items and services sold')}
              delta={percentageChange(quantitySold, previousQuantitySold)}
              icon={<PackageCheck aria-hidden="true" className="size-4" />}
            />
          </section>

          <section
            className={[
              'mt-5 grid gap-4',
              widgetEnabled('businessPerformance')
                ? 'lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]'
                : 'grid-cols-1',
            ].join(' ')}
          >
            {widgetEnabled('businessPerformance') ? (
              <BusinessPerformanceCard
                title={copy('Business performance')}
                periodLabel={periodLabel}
                revenue={revenue}
                transactions={transactionCount}
                previousRevenue={previousRevenue}
                previousTransactions={previousTransactionCount}
                trend={data?.analytics.trend ?? []}
                formatMoney={moneyNumber}
              />
            ) : null}
            <TransactionsCard
              title={copy("Today's transactions")}
              periodLabel={copy('Today')}
              total={todayTransactions.data?.total ?? 0}
              transactions={transactions}
              emptyMessage={copy('No transactions have been recorded today.')}
              formatDateTime={formatDateTime}
              formatMoney={money}
            />
          </section>

          {premium && (widgetEnabled('topItems') || widgetEnabled('topEmployees')) ? (
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {widgetEnabled('topItems') ? (
                <RankingCard
                  title={copy('Top 5 items')}
                  subtitle={periodLabel}
                  items={topItems}
                  emptyMessage={empty}
                />
              ) : null}
              {widgetEnabled('topEmployees') ? (
                <RankingCard
                  title={copy('Top 5 employees')}
                  subtitle={periodLabel}
                  items={topEmployees}
                  emptyMessage={empty}
                />
              ) : null}
            </section>
          ) : null}

          {premium &&
          (widgetEnabled('paymentMix') || widgetEnabled('locationPerformance')) ? (
            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              {widgetEnabled('paymentMix') ? (
                <PaymentMixCard
                  title={copy('Payment mix')}
                  points={paymentMix}
                  emptyMessage={empty}
                  formatValue={moneyNumber}
                />
              ) : null}
              {widgetEnabled('locationPerformance') ? (
                <RankingCard
                  title={copy('Location performance')}
                  subtitle={periodLabel}
                  items={topLocations}
                  emptyMessage={empty}
                />
              ) : null}
            </section>
          ) : null}

          {premium && widgetEnabled('businessInsight') ? (
            <section className="mt-4">
              <BusinessInsightWidget
                current={data}
                previous={previousData}
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
