import { AnalyticsInsightCard } from '../../../components/analytics/analytics-charts';
import type { DashboardDataset } from '../dashboard.types';

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
  currency,
  formatMoney,
}: {
  current?: DashboardDataset;
  previous?: DashboardDataset;
  currency: string;
  formatMoney(value: string, currency: string): string;
}) {
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

  const insights = [
    revenueChange === null
      ? revenue > 0
        ? `Revenue reached ${formatMoney(String(revenue), currency)} with no comparable revenue in the previous period.`
        : 'No revenue activity was recorded in the selected period.'
      : `Revenue is ${Math.abs(revenueChange).toFixed(1)}% ${revenueChange >= 0 ? 'higher' : 'lower'} than the previous comparable period.`,
    transactionChange === null
      ? transactions > 0
        ? `${transactions.toLocaleString('id-ID')} transactions were recorded, while the previous period had none.`
        : 'No transactions were recorded in either comparison period.'
      : `Transaction volume is ${Math.abs(transactionChange).toFixed(1)}% ${transactionChange >= 0 ? 'higher' : 'lower'} than the previous period.`,
    transactions > 0
      ? `Average transaction value is ${formatMoney(String(average), currency)}.`
      : null,
    dominantPayment
      ? `${dominantPayment.label} is the leading payment mix for this period.`
      : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <AnalyticsInsightCard title="Business insight" tone="primary">
      <div className="space-y-3">
        {insights.map((insight) => (
          <p
            key={insight}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs leading-5 text-[var(--color-text-muted)]"
          >
            {insight}
          </p>
        ))}
        <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
          Generated from report aggregates only. No external AI request or model cost is used.
        </p>
      </div>
    </AnalyticsInsightCard>
  );
}
