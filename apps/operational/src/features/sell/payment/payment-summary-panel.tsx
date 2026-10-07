import { createDecimal } from '@digvation/pos-money';
import { DBadge as Badge } from '@digvation-labs/ui';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  customerDisplayDetail,
  customerDisplayName,
  customerInitials,
  customerStatus,
} from '../customer/model/sale-customer-display';
import type { SaleCustomer } from '../transaction/model/cashier-transaction.types';
import { pointQuantity } from '../transaction/model/sale-points';
import type { PaymentProgress } from '../transaction/model/sale-presentation';
import { SaleCustomerStrip } from '../transaction/ui/sale-detail-presentation';
import { PaymentProgressSummary } from './payment-confirmation';

type Format = (amount: string) => string;

/** Who is paying; a Member also shows their current point balance. */
export function PaymentCustomerSummary({
  customer,
  locale,
  loyaltyPointBalance,
  isLoyaltyBalanceLoading,
}: {
  customer: SaleCustomer;
  locale: string;
  loyaltyPointBalance: string | null;
  isLoyaltyBalanceLoading: boolean;
}) {
  const { copy } = useOperationalLocalization();
  const customerBadge = customerStatus(customer);
  return (
    <SaleCustomerStrip
      initials={customerInitials(customer)}
      name={customerDisplayName(customer, locale)}
      detail={customerDisplayDetail(customer)}
      badge={
        customerBadge ? (
          <Badge variant={customerBadge.variant} className="shrink-0 px-2 py-0 text-[10px]">
            {copy(customerBadge.label)}
          </Badge>
        ) : null
      }
      aside={
        customer.type === 'MEMBER' ? (
          <>
            <p className="pos-pay-eyebrow">{copy('Points')}</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-[var(--color-warning)]">
              {isLoyaltyBalanceLoading ? '…' : `${pointQuantity(loyaltyPointBalance, locale)} PTS`}
            </p>
          </>
        ) : null
      }
    />
  );
}

/** The amount to pay, how it is composed, and how much of it is already paid. */
export function PaymentTotalSummary({
  total,
  saleTotal,
  gross,
  discountAmount,
  discountLabel,
  taxAmount,
  taxLabel,
  hasLoyaltyRedemption,
  redeemedAmount,
  progress,
  hasPaymentActivity,
  hasRecordedMoney,
  fullyPaid,
  format,
}: {
  total: string;
  /** Authoritative Sale total once the Sale exists; otherwise the draft total. */
  saleTotal: string;
  gross: string;
  discountAmount: string;
  discountLabel: string;
  taxAmount: string;
  taxLabel: string;
  hasLoyaltyRedemption: boolean;
  redeemedAmount: string | null;
  progress: PaymentProgress;
  hasPaymentActivity: boolean;
  hasRecordedMoney: boolean;
  fullyPaid: boolean;
  format: Format;
}) {
  const { copy } = useOperationalLocalization();
  const hasDiscount = !createDecimal(discountAmount).equals(createDecimal('0'));
  const hasTax = !createDecimal(taxAmount).equals(createDecimal('0'));
  return (
    <div className="pos-pay-section p-4 shadow-sm">
      <p className="pos-pay-eyebrow">{copy('Payment total')}</p>
      <h3 className="mt-0.5 text-3xl font-bold leading-tight tabular-nums text-[var(--color-brand)]">
        {format(total)}
      </h3>
      <div className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-3 text-[13px]">
        <div className="flex justify-between gap-3">
          <span className="text-[var(--color-text-muted)]">{copy('Subtotal')}</span>
          <span className="font-semibold tabular-nums">{format(gross)}</span>
        </div>
        {hasDiscount ? (
          <div className="flex justify-between gap-3">
            <span className="text-[var(--color-text-muted)]">{discountLabel}</span>
            <span className="font-semibold text-[var(--color-danger)]">
              −{format(discountAmount)}
            </span>
          </div>
        ) : null}
        {hasLoyaltyRedemption ? (
          <div className="flex justify-between gap-3">
            <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <span className="size-2 rounded-full bg-[var(--color-warning)]" />
              {copy('Loyalty redemption')}
            </span>
            <span className="font-semibold text-[var(--color-danger)]">
              −{format(redeemedAmount!)}
            </span>
          </div>
        ) : null}
        {hasTax ? (
          <div className="flex justify-between gap-3">
            <span className="text-[var(--color-text-muted)]">{taxLabel}</span>
            <span className="font-semibold">{format(taxAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-[var(--color-border)] pt-2.5 text-sm font-bold">
          <span className="font-bold">{copy('Net total')}</span>
          <span className="font-bold">{format(total)}</span>
        </div>
      </div>
      {hasPaymentActivity ? (
        <div className="mt-3">
          <PaymentProgressSummary total={saleTotal} progress={progress} format={format} />
          {hasRecordedMoney && !fullyPaid ? (
            <p className="mt-2 text-[11px] font-medium text-[var(--color-text-muted)]">
              {copy('The transaction is not complete until the remaining amount is paid.')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
