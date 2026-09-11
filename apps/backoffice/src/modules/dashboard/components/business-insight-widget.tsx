import { DCard } from '@digvation/ui';
import { Lightbulb } from 'lucide-react';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import { useDashboardI18n } from '../dashboard-i18n';
import type { DashboardDataset } from '../dashboard.types';
import { DashboardCardHeader } from './dashboard-card-header';

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function BusinessInsightWidget({
  current,
  previous,
  currency = 'IDR',
  formatMoney,
  seeAllHref,
}: {
  current: DashboardDataset | undefined;
  previous: DashboardDataset | undefined;
  currency?: string;
  formatMoney(value: string, currency: string): string;
  seeAllHref?: string;
}) {
  const { copy } = useBackofficeLocalization();
  const { locale, text } = useDashboardI18n();
  const revenue = numeric(current?.summary.finalRevenue);
  const transactions = numeric(current?.summary.transactionCount);
  const average = numeric(current?.summary.averageTransactionValue);
  const previousRevenue = numeric(previous?.summary.finalRevenue);
  const previousTransactions = numeric(previous?.summary.transactionCount);
  const revenueChange = change(revenue, previousRevenue);
  const transactionChange = change(transactions, previousTransactions);
  const paymentPoints = [
    ...(current?.analytics.breakdowns?.paymentMethod ??
      current?.analytics.breakdown ??
      []),
  ];
  paymentPoints.sort((a, b) => numeric(b.value) - numeric(a.value));
  const dominantPayment = paymentPoints[0];
  const integer = new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US');

  const revenueInsight =
    revenueChange === null
      ? revenue > 0
        ? locale === 'id'
          ? `Pendapatan mencapai ${formatMoney(String(revenue), currency)} tanpa pembanding pada bulan sebelumnya.`
          : `Revenue reached ${formatMoney(String(revenue), currency)} with no comparable revenue in the previous month.`
        : text('noRevenueMonth')
      : `${revenueChange >= 0 ? text('revenueHigher') : text('revenueLower')} ${Math.abs(revenueChange).toFixed(1)}% ${text('previousMonthSuffix')}`;

  const transactionInsight =
    transactionChange === null
      ? transactions > 0
        ? locale === 'id'
          ? `${integer.format(transactions)} transaksi tercatat, sementara bulan sebelumnya belum memiliki transaksi.`
          : `${integer.format(transactions)} transactions were recorded while the previous month had none.`
        : text('noTransactionsMonth')
      : `${transactionChange >= 0 ? text('transactionHigher') : text('transactionLower')} ${Math.abs(transactionChange).toFixed(1)}% ${text('previousMonthSuffix')}`;

  const insights = [
    revenueInsight,
    transactionInsight,
    transactions > 0
      ? `${text('averageTransactionValue')} ${locale === 'id' ? 'adalah' : 'is'} ${formatMoney(String(average), currency)}.`
      : null,
    dominantPayment
      ? `${copy(dominantPayment.label)} ${text('leadingPayment')}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <DCard
      variant="elevated"
      className="h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_16px_40px_-34px_var(--color-text)]"
    >
      <DashboardCardHeader
        title={text('businessInsight')}
        subtitle={text('insightComparison')}
        icon={<Lightbulb aria-hidden="true" className="size-4" />}
        actionHref={seeAllHref}
        tone="violet"
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {insights.map((insight) => (
          <div
            key={insight}
            className="rounded-xl bg-[var(--color-surface-muted)] px-3 py-3 text-xs leading-5 text-[var(--color-text-muted)]"
          >
            {insight}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] leading-4 text-[var(--color-text-muted)]">
        {text('insightSource')}
      </p>
    </DCard>
  );
}
