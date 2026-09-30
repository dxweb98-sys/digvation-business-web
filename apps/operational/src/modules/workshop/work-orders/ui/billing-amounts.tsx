import { formatMoney } from '@digvation/business-money';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopBilling } from '../api/workshop-billing-api';
import { formatTaxRate } from '../model/workshop-billing-model';

function useMoney(billing: WorkshopBilling) {
  const { locale } = useOperationalLocalization();
  return (amount: string) => formatMoney(amount, billing.currency, locale, 0);
}

/** Subtotal and tax: the quiet supporting lines. */
export function BillingBreakdown({
  billing,
  onInk = false,
}: {
  billing: WorkshopBilling;
  /** Drawn on the ink financial surface instead of a light one. */
  onInk?: boolean;
}) {
  const { copy } = useOperationalLocalization();
  const money = useMoney(billing);
  return (
    <dl className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <dt className={onInk ? 'text-white/65' : 'text-(--color-text-muted)'}>
          {copy('Subtotal')}
        </dt>
        <dd className={`tabular-nums ${onInk ? 'text-white/85' : 'text-(--color-text-muted)'}`}>
          {money(billing.subtotalAmount)}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <dt className={onInk ? 'text-white/65' : 'text-(--color-text-muted)'}>
          {billing.tax.enabled ? `${copy('Tax')} ${formatTaxRate(billing.tax.rate)}%` : copy('Tax')}
        </dt>
        <dd className={`tabular-nums ${onInk ? 'text-white/85' : 'text-(--color-text-muted)'}`}>
          {billing.tax.enabled ? money(billing.tax.amount) : copy('Not charged')}
        </dd>
      </div>
    </dl>
  );
}

/** The total: the strongest figure of the billing. */
export function BillingTotal({
  billing,
  onInk = false,
}: {
  billing: WorkshopBilling;
  onInk?: boolean;
}) {
  const { copy } = useOperationalLocalization();
  const money = useMoney(billing);
  return (
    <dl className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm font-semibold ${onInk ? 'text-white/90' : 'text-(--color-text)'}`}>
        {copy('Total')}
      </dt>
      <dd
        className={`text-2xl font-bold tabular-nums tracking-tight ${onInk ? 'text-white' : 'text-(--color-text)'}`}
      >
        {money(billing.totalAmount)}
      </dd>
    </dl>
  );
}

/** Breakdown and total together, for the validation confirmation. */
export function BillingAmounts({ billing }: { billing: WorkshopBilling }) {
  return (
    <div>
      <BillingBreakdown billing={billing} />
      <div className="mt-3 border-t border-(--color-border) pt-3">
        <BillingTotal billing={billing} />
      </div>
    </div>
  );
}
