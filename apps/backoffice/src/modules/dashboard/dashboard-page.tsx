import { useRuntime } from '@digvation/business-runtime';
import { DCard } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';

import { BackofficePage } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBusinessLocation } from '../../app/providers/business-location-context';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  canAccessReport,
  canShowDashboardWidget,
  isReportAvailable,
} from '../reporting/report-availability';
import { BusinessInsightWidget } from './components/business-insight-widget';
import { BusinessPerformanceCard } from './components/business-performance-card';
import { DashboardKpiCard } from './components/dashboard-kpi-card';
import { PaymentMixCard } from './components/payment-mix-card';
import { RankingCard } from './components/ranking-card';
import { TransactionCompletionCard } from './components/transaction-completion-card';
import { TransactionsCard } from './components/transactions-card';
import { DashboardApi } from './dashboard-api';
import { useDashboardI18n } from './dashboard-i18n';
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

function welcomeCopy(locale: 'id' | 'en', name: string, hour: number) {
  if (locale === 'id') {
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

  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
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
  const { formatMoney } = useBackofficeLocalization();
  const { locale, text } = useDashboardI18n();
  const {
    selectedLocationId: locationId,
    isReady: locationReady,
    isDenied: locationDenied,
  } = useBusinessLocation();
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('month');
  const api = useMemo(
    () => new DashboardApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  // Core dashboard availability is independent from report hide preferences.
  const canReadSales = isReportAvailable(session, 'business-performance');
  const canReadExpenses = isReportAvailable(session, 'expenses');
  const canReadCatalog = isReportAvailable(session, 'catalog-performance');
  const canReadEmployees = isReportAvailable(session, 'employee-performance');

  const showTopItems = canShowDashboardWidget(session, 'TOP_ITEMS');
  const showPaymentMix = canShowDashboardWidget(session, 'PAYMENT_MIX');
  const showRecentTransactions = canShowDashboardWidget(session, 'RECENT_TRANSACTIONS');
  const showTopEmployees = canShowDashboardWidget(session, 'TOP_EMPLOYEES');
  const showBusinessInsight = canShowDashboardWidget(session, 'BUSINESS_INSIGHT');

  const activity = periodRange(activityPeriod);
  const previousActivity = previousRange(activity.from, activity.to);
  const month = periodRange('month');
  const previousMonth = previousRange(month.from, month.to);
  const recent = recentRange(30);

  const activityFilters: DashboardFilterState = { ...activity, locationId };
  const previousActivityFilters: DashboardFilterState = { ...previousActivity, locationId };
  const expenseActivityFilters: DashboardFilterState = { ...activityFilters, status: 'APPROVED' };
  const previousExpenseActivityFilters: DashboardFilterState = {
    ...previousActivityFilters,
    status: 'APPROVED',
  };
  const monthFilters: DashboardFilterState = { ...month, locationId };
  const previousMonthFilters: DashboardFilterState = { ...previousMonth, locationId };
  const recentFilters: DashboardFilterState = { ...recent, locationId };
  const reportEnabled = Boolean(session && canReadSales && locationReady);

  const dailySummary = useQuery({
    queryKey: ['dashboard', 'daily-summary', locationId],
    queryFn: () => api.dailySummary(locationId),
    enabled: reportEnabled,
  });
  const activityPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', activityFilters],
    queryFn: () => api.report('business-performance', activityFilters),
    enabled: reportEnabled,
  });
  const previousActivityPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', 'previous-activity', previousActivityFilters],
    queryFn: () => api.report('business-performance', previousActivityFilters),
    enabled: reportEnabled,
  });
  const activityExpenses = useQuery({
    queryKey: ['dashboard', 'expenses', expenseActivityFilters],
    queryFn: () => api.report('expenses', expenseActivityFilters),
    enabled: Boolean(session && canReadExpenses && locationReady),
  });
  const previousActivityExpenses = useQuery({
    queryKey: ['dashboard', 'expenses', 'previous-activity', previousExpenseActivityFilters],
    queryFn: () => api.report('expenses', previousExpenseActivityFilters),
    enabled: Boolean(session && canReadExpenses && locationReady),
  });
  const lastTransactions = useQuery({
    queryKey: ['dashboard', 'last-transactions', recentFilters],
    queryFn: () => api.report('transactions', recentFilters, 6),
    enabled: Boolean(reportEnabled && showRecentTransactions),
  });
  const monthPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', monthFilters],
    queryFn: () => api.report('business-performance', monthFilters),
    enabled: Boolean(reportEnabled && (showPaymentMix || showBusinessInsight)),
  });
  const previousMonthPerformance = useQuery({
    queryKey: ['dashboard', 'business-performance', 'previous-month', previousMonthFilters],
    queryFn: () => api.report('business-performance', previousMonthFilters),
    enabled: Boolean(reportEnabled && showBusinessInsight),
  });
  const catalogPerformance = useQuery({
    queryKey: ['dashboard', 'catalog-performance', monthFilters],
    queryFn: () => api.report('catalog-performance', monthFilters, 5),
    enabled: Boolean(session && canReadCatalog && locationReady && showTopItems),
  });
  const employeePerformance = useQuery({
    queryKey: ['dashboard', 'employee-performance', monthFilters],
    queryFn: () => api.report('employee-performance', monthFilters, 5),
    enabled: Boolean(session && canReadEmployees && locationReady && showTopEmployees),
  });

  if (!session) return null;

  const numberLocale = locale === 'id' ? 'id-ID' : 'en-US';
  const formatInteger = (value: number | string) =>
    new Intl.NumberFormat(numberLocale).format(Number(value) || 0);
  const formatDateTime = (value: DashboardRow[string] | undefined) => {
    if (typeof value !== 'string') return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(numberLocale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };
  const money = (value: DashboardRow[string] | undefined) =>
    formatMoney(String(value ?? 0), runtime.currency);
  const moneyNumber = (value: number) => formatMoney(String(value), runtime.currency);
  const dailyMoney = (value: string | undefined) =>
    formatMoney(String(value ?? '0'), summary?.currency ?? runtime.currency);

  const summary = dailySummary.data;
  const activityData = activityPerformance.data;
  const previousActivityData = previousActivityPerformance.data;
  const activityExpenseData = activityExpenses.data;
  const previousActivityExpenseData = previousActivityExpenses.data;
  const activityRevenue = numberValue(activityData?.summary.finalRevenue);
  const previousActivityRevenue = numberValue(previousActivityData?.summary.finalRevenue);
  const activityTransactions = numberValue(activityData?.summary.transactionCount);
  const previousActivityTransactions = numberValue(previousActivityData?.summary.transactionCount);
  const approvedExpenses = numberValue(activityExpenseData?.summary.approvedExpenseTotal);
  const previousApprovedExpenses = numberValue(
    previousActivityExpenseData?.summary.approvedExpenseTotal,
  );
  const monthData = monthPerformance.data;
  const previousMonthData = previousMonthPerformance.data;

  const paymentMix =
    monthData?.analytics.breakdowns?.paymentMethod ?? monthData?.analytics.breakdown ?? [];
  const recentTransactions = lastTransactions.data?.items ?? [];
  const topItems = (catalogPerformance.data?.items ?? []).slice(0, 5).map((row) => ({
    label: String(row.itemName ?? '—'),
    secondary: `${formatInteger(numberValue(row.quantitySold))} ${text('sold')} · ${formatInteger(numberValue(row.transactionCount))} ${text('txShort')}`,
    value: money(row.finalRevenue),
  }));
  const topEmployees = (employeePerformance.data?.items ?? []).slice(0, 5).map((row) => ({
    label: String(row.employeeName ?? '—'),
    secondary: `${formatInteger(numberValue(row.contributedTransactions))} ${text('txShort')} · ${String(row.topCatalogItem ?? '—')}`,
    value: money(row.contributionRevenue),
  }));

  const firstName =
    session.identity.displayName.trim().split(/\s+/)[0] || (locale === 'id' ? 'Pengguna' : 'there');
  const welcome = welcomeCopy(locale, firstName, new Date().getHours());

  const transactionReportHref = canAccessReport(session, 'transactions')
    ? reportHref('transactions', locationId, recent)
    : undefined;
  const catalogReportHref = canAccessReport(session, 'catalog-performance')
    ? reportHref('catalog-performance', locationId, month)
    : undefined;
  const employeeReportHref = canAccessReport(session, 'employee-performance')
    ? reportHref('employee-performance', locationId, month)
    : undefined;
  const paymentReportHref = canAccessReport(session, 'payments')
    ? reportHref('payments', locationId, month)
    : undefined;
  const performanceReportHref = canAccessReport(session, 'business-performance')
    ? reportHref('business-performance', locationId, month)
    : undefined;

  return (
    <BackofficePage>
      <section className="pt-2">
        <p className="text-sm font-medium text-[var(--color-text-muted)]">{welcome.greeting}</p>
        <h1 className="mt-1 text-[clamp(1.65rem,2vw,2.15rem)] font-semibold tracking-[-0.035em] text-[var(--color-text)]">
          {welcome.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
          {welcome.description}
        </p>
      </section>

      {!canReadSales ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">{text('salesUnavailable')}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {text('salesUnavailableDescription')}
          </p>
        </DCard>
      ) : null}

      {canReadSales && !locationReady ? (
        <DCard
          variant="elevated"
          className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <p className="text-sm font-semibold">{text('selectLocation')}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {locationDenied
              ? text('salesUnavailableDescription')
              : text('selectLocationDescription')}
          </p>
        </DCard>
      ) : null}

      {canReadSales && locationReady ? (
        <>
          {dailySummary.isPending ? (
            <DCard
              variant="elevated"
              className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <p className="text-sm text-[var(--color-text-muted)]">{text('summaryLoading')}</p>
            </DCard>
          ) : dailySummary.isError || !summary ? (
            <DCard
              variant="elevated"
              className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <p className="text-sm font-semibold">{text('summaryError')}</p>
            </DCard>
          ) : (
            <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DashboardKpiCard
                label={text('incomeToday')}
                value={dailyMoney(summary.income)}
                context={text('today')}
                tone="sky"
                icon={<CircleDollarSign aria-hidden="true" className="size-4" />}
              />
              {canReadExpenses &&
              summary.financeAvailable &&
              summary.expenses !== undefined &&
              summary.netRevenue !== undefined ? (
                <>
                  <DashboardKpiCard
                    label={text('expensesToday')}
                    value={dailyMoney(summary.expenses)}
                    context={text('today')}
                    tone="warm"
                    icon={<WalletCards aria-hidden="true" className="size-4" />}
                  />
                  <DashboardKpiCard
                    label={text('netRevenueToday')}
                    value={dailyMoney(summary.netRevenue)}
                    context={text('today')}
                    tone="violet"
                    icon={<TrendingUp aria-hidden="true" className="size-4" />}
                  />
                </>
              ) : null}
              <DashboardKpiCard
                label={text('transactionsToday')}
                value={formatInteger(summary.totalTransactions)}
                context={text('today')}
                tone="mint"
                icon={<ReceiptText aria-hidden="true" className="size-4" />}
              />
            </section>
          )}

          <section className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(280px,0.72fr)]">
            <BusinessPerformanceCard
              title={text('activity')}
              period={activityPeriod}
              periodOptions={[
                { value: 'today', label: text('today') },
                { value: '7d', label: text('last7Days') },
                { value: 'month', label: text('thisMonth') },
                { value: 'year', label: text('thisYear') },
              ]}
              onPeriodChange={(value) => setActivityPeriod(value as ActivityPeriod)}
              revenue={activityRevenue}
              transactions={activityTransactions}
              previousRevenue={previousActivityRevenue}
              previousTransactions={previousActivityTransactions}
              trend={activityData?.analytics.trend ?? []}
              expenses={approvedExpenses}
              previousExpenses={previousApprovedExpenses}
              expenseTrend={activityExpenseData?.analytics.trend ?? []}
              showExpenses={canReadExpenses}
              formatMoney={moneyNumber}
            />
            {summary ? (
              <TransactionCompletionCard
                finalized={summary.transactionCompletion.finalized}
                total={summary.transactionCompletion.total}
                voided={summary.transactionCompletion.voided}
              />
            ) : null}
          </section>

          {showTopItems || showPaymentMix || showRecentTransactions ? (
            <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {showTopItems ? (
                <RankingCard
                  title={text('topItems')}
                  subtitle={text('thisMonth')}
                  items={topItems}
                  emptyMessage={text('noSummary')}
                  kind="items"
                  seeAllHref={catalogReportHref}
                />
              ) : null}
              {showPaymentMix ? (
                <PaymentMixCard
                  title={`${text('paymentMix')} · ${text('thisMonth')}`}
                  points={paymentMix}
                  emptyMessage={text('noSummary')}
                  formatValue={moneyNumber}
                  seeAllHref={paymentReportHref}
                />
              ) : null}
              {showRecentTransactions ? (
                <TransactionsCard
                  title={text('lastTransactions')}
                  periodLabel={text('latest')}
                  total={lastTransactions.data?.total ?? 0}
                  transactions={recentTransactions}
                  emptyMessage={text('noRecentTransactions')}
                  formatDateTime={formatDateTime}
                  formatMoney={money}
                  seeAllHref={transactionReportHref}
                />
              ) : null}
            </section>
          ) : null}

          {showTopEmployees || showBusinessInsight ? (
            <section className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
              {showTopEmployees ? (
                <RankingCard
                  title={text('topEmployees')}
                  subtitle={text('thisMonth')}
                  items={topEmployees}
                  emptyMessage={text('noSummary')}
                  kind="employees"
                  seeAllHref={employeeReportHref}
                />
              ) : null}
              {showBusinessInsight ? (
                <BusinessInsightWidget
                  current={monthData}
                  previous={previousMonthData}
                  currency={runtime.currency}
                  formatMoney={formatMoney}
                  seeAllHref={performanceReportHref}
                />
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </BackofficePage>
  );
}
