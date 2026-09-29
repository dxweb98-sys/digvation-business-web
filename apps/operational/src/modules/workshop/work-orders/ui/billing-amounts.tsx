import { formatMoney } from '@digvation/business-money';

import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { WorkshopBilling } from '../api/workshop-billing-api';
import { formatTaxRate } from '../model/workshop-billing-model';

/** Subtotal, tax and total exactly as Runtime calculated them. Used by the section and the dialog. */
export function BillingAmounts({ billing }: { billing: WorkshopBilling }) {
  const { copy, locale } = useOperationalLocalization();
  const money = (amount: string) => formatMoney(amount, billing.currency, locale, 0);
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-(--color-text-muted)">{copy('Subtotal')}</dt>
        <dd className="tabular-nums text-(--color-text)">{money(billing.subtotalAmount)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-(--color-text-muted)">
          {billing.tax.enabled ? `${copy('Tax')} ${formatTaxRate(billing.tax.rate)}%` : copy('Tax')}
        </dt>
        <dd className="tabular-nums text-(--color-text)">
          {billing.tax.enabled ? money(billing.tax.amount) : copy('Not charged')}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-(--color-border) pt-2">
        <dt className="font-semibold text-(--color-text)">{copy('Total')}</dt>
        <dd className="text-base font-semibold tabular-nums text-(--color-text)">
          {money(billing.totalAmount)}
        </dd>
      </div>
    </dl>
  );
}
