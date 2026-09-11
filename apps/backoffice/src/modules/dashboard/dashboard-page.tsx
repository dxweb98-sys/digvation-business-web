import { useRuntime } from '@digvation/business-runtime';
import { DCard } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  Hash,
  PackageCheck,
  ReceiptText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { BackofficePage } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BranchContextCard } from './components/branch-context-card';
import { BusinessInsightWidget } from './components/business-insight-widget';
import { BusinessPerformanceCard } from './components/business-performance-card';
import { DashboardKpiCard } from './components/dashboard-kpi-card';
import { PaymentMixCard } from './components/payment-mix-card';
import { RankingCard } from './components/ranking-card';
import { TransactionCompletionCard } from './components/transaction-completion-card';
import { TransactionsCard } from './components/transactions-card';
import { DashboardApi } from './dashboard-api';
import type { DashboardFilterState, DashboardRow } from './dashboard.types';

const DAY_MS = 86_400_000;
type ActivityPeriod = 'today' | '7d' | 'month' | 'year';

type DateRange = { from: string; to: string };

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodRange(period: ActivityPeriod, date = new Date()): DateRange {
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

function recentRange(days: number, date = new Date()): DateRange {
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

function reportHref(type: string, locationId: string, range: DateRange): string {
  const params = new URLSearchParams({
    type,
    sellingLocationId: locationId,
    dateFrom: range.from,
    dateTo: range.to,
  });
  return `/reports?${params.toString()}`;
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
    return window.localStorage.getItem(key);
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

function welcomeCopy(locale: string, name: string, hour: number) {
  const indonesian = locale.toLowerCase().startsWith('id');
  if (indonesian) {
    const greeting =
      hour < 11
        ? 'Selamat pagi'
        : hour < 15
          ? 'Selamat siang'
          : hour < 18
            ? 'Selamat sore'
            : 'Selamat malam';
    return {
      greeting: `${greeting}, ${name}!`,
      title: 'Berikut ringkasan bisnis Anda',
      description:
        'Pantau performa cabang hari ini dan aktivitas bisnis terbaru dalam satu tampilan.',
    };
  }

  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return {
    greeting: `${greeting}, ${name}!`,
    title: "Here's your business overview",
    description:
      'See how your branch is performing today and catch up on the latest business activity.',
  };
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

  const api = useMemo(
    () => new DashboardApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const permissions = session?.identity.permissions ?? [];
  const locationPreferenceKey = session
    ? `digvation.backoffice.dashboard.location.v1:${session.identity.workspace}:${session.identity.userId}`
    : 'digvation.backoffice.dashboard.location.v1:anonymous';

  useEffect(() => {
    setSelectedLocationId(loadLocationPreference(locationPreferenceKey));
  }, [locationPreferenceKey]);

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
    selectedLocationId !== null && accessibleLocationIds.has(selectedLocationId);
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
  const canReadPayments = permissions.includes('payments:read');

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
  const todayTransactions = useQuery({
    queryKey: ['dashboard', 'today-transaction-summary', todayFilters],
    queryFn: () => api.report('transactions', todayFilters, 1),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const activityPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', activityFilters],
    queryFn: () => api.report('business-performance', activityFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const previousActivityPerformance = useQuery({
    queryKey: [
      'dashboard',
      'business-performance',
      'previous-activity',
      previousActivityFilters,
    ],
    queryFn: () => api.report('business-performance', previousActivityFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const lastTransactions = useQuery({
    queryKey: ['dashboard', 'last-transactions', recentFilters],
    queryFn: () => api.report('transactions', recentFilters, 6),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const monthPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', monthFilters],
    queryFn: () => api.report('business-performance', monthFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const previousMonthPerformance = useQuery({
    queryKey: [
      'dashboard',
      'business-performance',
      'previous-month',
      previousMonthFilters,
    ],
    queryFn: () => api.report('business-performance', previousMonthFilters),
    enabled: Boolean(session && canReadSales && locationReady),
  });
  const catalogPerformance = useQuery({
    queryKey: ['dashboard', 'catalog-performance', monthFilters],
    queryFn: () => api.report('catalog-performance', monthFilters, 5),
    enabled: Boolean(session && canReadCatalog && locationReady),
  });
  const employeePerformance = useQuery({
    queryKey: ['dashboard', 'employee-performance', monthFilters],
    queryFn: () => api.report('employee-performance', monthFilters, 5),
    enabled: Boolean(session && canReadEmployees && locationReady),
  });

  if (!session) return null;

  const selectLocation = (value: string) => {
    if (!accessibleLocationIds.has(value)) return;
    setSelectedLocationId(value);
    saveLocationPreference(locationPreferenceKey, value);
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
  const todayTransactionData = todayTransactions.data;
  const activityData = activityPerformance.data;
  const previousActivityData = previousActivityPerformance.data;
  const monthData = monthPerformance.data;
  const previousMonthData = previousMonthPerformance.data;

  const revenueToday = numberValue(todayData?.summary.finalRevenue);
  const revenueYesterday = numberValue(yesterdayData?.summary.finalRevenue);
  const transactionsToday = numberValue(todayData?.summary.transactionCount);
  const transactionsYesterday = numberValue(
    yesterdayData?.summary.transactionCount,
  );
  const averageToday = numberValue(todayData?.summary.averageTransactionValue);
  const averageYesterday = numberValue(
    yesterdayData?.summary.averageTransactionValue,
  );
  const quantityToday = numberValue(todayData?.summary.quantitySold);
  const quantityYesterday = numberValue(yesterdayData?.summary.quantitySold);

  const activityRevenue = numberValue(activityData?.summary.finalRevenue);
  const previousActivityRevenue = numberValue(
    previousActivityData?.summary.finalRevenue,
  );
  const activityTransactions = numberValue(
    activityData?.summary.transactionCount,
  );
  const previousActivityTransactions = numberValue(
    previousActivityData?.summary.transactionCount,
  );

  const transactionTotalToday = numberValue(
    todayTransactionData?.summary.transactionCount,
  );
  const finalizedToday = numberValue(todayTransactionData?.summary.finalizedCount);
  const voidedToday = numberValue(todayTransactionData?.summary.voidedCount);

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

  const locationOptions = [...(locations.data?.locations ?? [])].sort(
    (left, right) => {
      if (left.id === locations.data?.mainLocationId) return -1;
      if (right.id === locations.data?.mainLocationId) return 1;
      return (left.name ?? left.displayName ?? left.code).localeCompare(
        right.name ?? right.displayName ?? right.code,
      );
    },
  );

  const firstName = session.identity.displayName.trim().split(/\s+/)[0] || 'there';
  const welcome = welcomeCopy(runtime.locale, firstName, new Date().getHours());

  const transactionReportHref = reportHref('transactions', locationId, recent);
  const catalogReportHref = reportHref('catalog-performance', locationId, month);
  const employeeReportHref = reportHref(
    'employee-performance',
    locationId,
    month,
  );
  const paymentReportHref = canReadPayments
    ? reportHref('payments', locationId, month)
    : undefined;
  const performanceReportHref = reportHref(
    'business-performance',
    locationId,
    month,
  );

  return (
    <BackofficePage>
      <section className="grid gap-4 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            {welcome.greeting} <span aria-hidden="true">👋</span>
          </p>
          <h1 className="mt-1 text-[clamp(1.65rem,2vw,2.15rem)] font-semibold tracking-[-0.035em] text-[var(--color-text)]">
            {welcome.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
            {welcome.description}
          </p>
        </div>

        {locations.data && locationReady ? (
          <BranchContextCard
            locations={locationOptions}
            selectedId={locationId}
            mainLocationId={locations.data.mainLocationId}
            onChange={selectLocation}
          />
        ) : null}
      </section>

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
              context={copy('vs yesterday')}
              delta={percentageChange(revenueToday, revenueYesterday)}
              trendStart={revenueYesterday}
              trendEnd={revenueToday}
              tone="sky"
              icon={<CircleDollarSign aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Transactions today')}
              value={formatInteger(transactionsToday)}
              context={copy('vs yesterday')}
              delta={percentageChange(
                transactionsToday,
                transactionsYesterday,
              )}
              trendStart={transactionsYesterday}
              trendEnd={transactionsToday}
              tone="mint"
              icon={<ReceiptText aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Average transaction today')}
              value={money(todayData?.summary.averageTransactionValue)}
              context={copy('vs yesterday')}
              delta={percentageChange(averageToday, averageYesterday)}
              trendStart={averageYesterday}
              trendEnd={averageToday}
              tone="violet"
              icon={<Hash aria-hidden="true" className="size-4" />}
            />
            <DashboardKpiCard
              label={copy('Quantity sold today')}
              value={formatInteger(quantityToday)}
              context={copy('vs yesterday')}
              delta={percentageChange(quantityToday, quantityYesterday)}
              trendStart={quantityYesterday}
              trendEnd={quantityToday}
              tone="warm"
              icon={<PackageCheck aria-hidden="true" className="size-4" />}
            />
          </section>

          <section className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.72fr)]">
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

            <TransactionCompletionCard
              finalized={finalizedToday}
              total={transactionTotalToday}
              voided={voidedToday}
            />
          </section>

          <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {canReadCatalog ? (
              <RankingCard
                title={copy('Top 5 items')}
                subtitle={copy('This month')}
                items={topItems}
                emptyMessage={empty}
                kind="items"
                seeAllHref={catalogReportHref}
              />
            ) : null}

            <PaymentMixCard
              title={copy('Payment mix · This month')}
              points={paymentMix}
              emptyMessage={empty}
              formatValue={moneyNumber}
              seeAllHref={paymentReportHref}
            />

            <TransactionsCard
              title={copy('Last transactions')}
              periodLabel={copy('Latest')}
              total={lastTransactions.data?.total ?? 0}
              transactions={recentTransactions}
              emptyMessage={copy(
                'No transactions have been recorded in the last 30 days.',
              )}
              formatDateTime={formatDateTime}
              formatMoney={money}
              seeAllHref={transactionReportHref}
            />
          </section>

          <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
            {canReadEmployees ? (
              <RankingCard
                title={copy('Top 5 employees')}
                subtitle={copy('This month')}
                items={topEmployees}
                emptyMessage={empty}
                kind="employees"
                seeAllHref={employeeReportHref}
              />
            ) : null}

            <BusinessInsightWidget
              current={monthData}
              previous={previousMonthData}
              currency={runtime.currency}
              formatMoney={formatMoney}
              seeAllHref={performanceReportHref}
            />
          </section>
        </>
      ) : null}
    </BackofficePage>
  );
}
