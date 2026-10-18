import { DRadio } from '@digvation-labs/ui';
import { Clock } from 'lucide-react';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';

/**
 * Whether the transaction is paid now or later. An all-INSTANT Sale is always paid now, so it shows
 * only the payment allocation (`children`).
 */
export function PaymentTimingSection({
  instantOnly,
  payNow,
  onPayNowChange,
  children,
}: {
  instantOnly: boolean;
  payNow: boolean;
  onPayNowChange: (payNow: boolean) => void;
  children: ReactNode;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <section className="pos-pay-section pos-pay-section--primary">
      <div className="pos-pay-section__head">
        <p className="pos-pay-section__title">
          <Clock className="size-4 shrink-0 text-[var(--color-brand)]" aria-hidden="true" />
          {copy(instantOnly ? 'Payment' : 'Payment timing')}
        </p>
      </div>
      <div className="pos-pay-section__body">
        {instantOnly ? null : (
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              {
                value: true,
                title: copy('Pay now'),
                description: copy('Choose a payment method before continuing.'),
              },
              {
                value: false,
                title: copy('Pay later'),
                description: copy('Payment can be recorded after transaction creation.'),
              },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={`pos-choice ${payNow === option.value ? 'pos-choice--selected' : ''}`}
              >
                <DRadio
                  name="pos-payment-timing"
                  className="mt-0.5 shrink-0"
                  checked={payNow === option.value}
                  onChange={() => onPayNowChange(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-[var(--color-text-muted)]">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}
