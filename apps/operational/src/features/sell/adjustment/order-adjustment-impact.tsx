import { DAlert } from '@digvation-labs/ui';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { OrderAdjustmentPreview } from '../transaction/api/cashier-transaction.adapter';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { money } from '../transaction/model/sale-display';
import { SettlementFigure } from './item-correction-impact';

/**
 * What saving the adjustment would do to money, exactly as Runtime calculated it, before anything
 * is saved. A draft that leaves no item is shown as what it is, a cancellation, never as an
 * adjusted Sale of Rp 0 that looks paid.
 */
export function OrderAdjustmentImpact({
  preview,
  sale,
  locale,
}: {
  preview: OrderAdjustmentPreview;
  /** The persisted Sale: names the original payments a refund is attributed to. */
  sale: Sale;
  locale: string;
}) {
  const { copy, label } = useOperationalLocalization();
  const { settlement } = preview;
  const sourceName = (paymentId: string, method: string) => {
    const payment = sale.payments.find((entry) => entry.id === paymentId);
    const account = payment?.financeFinancialAccountNameSnapshot;
    return account && account !== method ? `${label(method)} · ${account}` : label(method);
  };
  return (
    <section
      aria-label={copy('Adjustment impact')}
      aria-live="polite"
      className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm"
    >
      {settlement.voidRequired ? (
        <div className="mb-2">
          <p className="font-semibold text-[var(--color-danger)]">
            {copy('All items will be removed')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {copy('This transaction no longer has any items. Saving will cancel the transaction.')}
          </p>
        </div>
      ) : null}
      <dl className="space-y-1.5 text-[var(--color-text-muted)]">
        <SettlementFigure
          label={copy('Previous total')}
          value={preview.current.totalAmount}
          locale={locale}
        />
        {settlement.voidRequired ? null : (
          <SettlementFigure
            label={copy('Total after adjustment')}
            value={preview.proposedSale.totalAmount}
            className="font-semibold text-[var(--color-text)]"
            locale={locale}
          />
        )}
        <SettlementFigure
          label={copy('Already paid')}
          value={preview.current.paidAmount}
          locale={locale}
        />
      </dl>
      {settlement.voidRequired && !settlement.refundRequired ? null : (
        <div className="mt-2 space-y-1.5 border-t border-[var(--color-border)] pt-2">
          {settlement.consequence === 'ADDITIONAL_PAYMENT_REQUIRED' ? (
            <dl>
              <SettlementFigure
                label={copy('Remaining to pay')}
                value={settlement.amount}
                className="font-semibold text-[var(--color-text)]"
                locale={locale}
              />
            </dl>
          ) : settlement.refundRequired ? (
            <dl className="space-y-1.5">
              <SettlementFigure
                label={copy('Refunded to customer')}
                value={settlement.refundAmount}
                className="font-semibold text-[var(--color-warning)]"
                locale={locale}
              />
              {/* Where the refundable money came from; how it is returned is chosen below. */}
              {settlement.refundSources.map((source) => (
                <div
                  key={source.sourcePaymentId}
                  className="flex items-baseline justify-between gap-3 text-xs text-[var(--color-text-muted)]"
                >
                  <dt>
                    {copy('Original payment')}: {sourceName(source.sourcePaymentId, source.method)}
                  </dt>
                  <dd className="tabular-nums">{money(source.amount, locale)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="font-semibold text-[var(--color-text)]">{copy('Paid in full')}</p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Why Runtime would refuse the save for lack of authority, as one reason: the void permission when
 * the draft cancels the transaction, otherwise the refund permission when money is returned.
 */
export function OrderAdjustmentAuthorityAlert({
  preview,
  locale,
}: {
  preview: OrderAdjustmentPreview;
  locale: string;
}) {
  const { copy } = useOperationalLocalization();
  const { settlement } = preview;
  if (settlement.voidRequired && !settlement.voidPermissionGranted)
    return (
      <DAlert variant="danger">
        <p>{copy('Canceling this transaction requires the void permission.')}</p>
        <p>{copy('Ask a supervisor to complete this adjustment.')}</p>
      </DAlert>
    );
  if (settlement.refundPermissionRequired && !settlement.refundPermissionGranted)
    return (
      <DAlert variant="danger">
        <p>
          {copy('A refund of')} {money(settlement.refundAmount, locale)} {copy('is required.')}
        </p>
        <p>{copy('Your account does not have permission to refund payments.')}</p>
        <p>{copy('Ask a supervisor to complete this adjustment.')}</p>
      </DAlert>
    );
  return null;
}

/** Issue codes the authority alert explains; every other issue is listed on its own. */
export const AUTHORITY_ISSUE_CODES: readonly string[] = [
  'PAYMENT_REFUND_FORBIDDEN',
  'SALE_VOID_FORBIDDEN',
];
