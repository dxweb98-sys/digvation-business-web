import { DButton as Button, DCheckbox, DDialog as Dialog } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import type { PaymentRoute, Sale } from '../model/cashier-transaction.types';
import type { RefundDisbursementDraft } from '../../adjustment/model/refund-disbursement-draft';
import { RefundDisbursementPicker } from '../../adjustment/ui/refund-disbursement-picker';
import { financialSummary } from '../../payment/model/sale-payment-status';
import { money, transactionNumber, isPositiveDecimal } from '../model/sale-display';
import { awaitsSettlement } from '../model/sale-lifecycle';

export function ReferenceCancelDialog({
  sale,
  reason,
  isMutating,
  onReasonChange,
  onClose,
  onConfirm,
  paymentRoutes,
  disbursement,
  onDisbursementChange,
  moneyReturned = false,
  onMoneyReturnedChange,
}: {
  sale: Sale | null;
  reason: string;
  isMutating: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** The location's routes; a paid Sale returns its money through one of them. */
  paymentRoutes: readonly PaymentRoute[];
  disbursement: RefundDisbursementDraft | null;
  onDisbursementChange: (next: RefundDisbursementDraft) => void;
  /** Required for a Sale awaiting settlement: the operator confirms the money is really back. */
  moneyReturned?: boolean;
  onMoneyReturnedChange?: (next: boolean) => void;
}) {
  const { copy, locale } = useOperationalLocalization();
  const refundAmount = sale ? financialSummary(sale).totalPaid : '0.0000';
  const hasRefund = isPositiveDecimal(refundAmount);
  // A Product-only Sale that already received money is cancelled only with the money returned.
  const confirmsReturn = hasRefund && awaitsSettlement(sale);
  return (
    <Dialog
      open={Boolean(sale)}
      title={copy('Cancel transaction')}
      description={sale ? transactionNumber(sale, locale) : ''}
      onClose={onClose}
      ariaLabel={copy('Cancel transaction')}
      closeOnEscape={!isMutating}
      closeOnOverlay={!isMutating}
      className="pos-reference-dialog w-full max-w-md rounded-t-2xl bg-(--color-surface) shadow-xl sm:rounded-xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={isMutating} onClick={onClose}>
            {copy('Back')}
          </Button>
          <Button
            variant="danger"
            disabled={
              !reason.trim() ||
              (hasRefund && !disbursement) ||
              (confirmsReturn && !moneyReturned) ||
              isMutating
            }
            loading={isMutating}
            onClick={onConfirm}
          >
            {copy(confirmsReturn ? 'Refund and cancel' : 'Confirm cancellation')}
          </Button>
        </div>
      }
    >
      <>
        {hasRefund ? (
          // Cancelling a paid transaction returns everything paid, manually, through an account the
          // operator chooses; the earlier payments stay recorded.
          <div className="mt-4 rounded-xl border border-(--color-warning)/30 bg-(--color-warning)/10 px-3 py-3">
            {confirmsReturn && sale ? (
              <dl className="mb-3 space-y-1.5 border-b border-(--color-warning)/25 pb-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-(--color-text-muted)">{copy('Transaction total')}</dt>
                  <dd className="font-semibold tabular-nums">{money(sale.totalAmount, locale)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-(--color-text-muted)">{copy('Already received')}</dt>
                  <dd className="font-semibold tabular-nums">{money(refundAmount, locale)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">{copy('To be refunded')}</dt>
                  <dd className="font-bold tabular-nums text-(--color-danger)">
                    {money(refundAmount, locale)}
                  </dd>
                </div>
              </dl>
            ) : null}
            <RefundDisbursementPicker
              amount={refundAmount}
              routes={paymentRoutes}
              value={disbursement}
              onChange={onDisbursementChange}
              locale={locale}
              disabled={isMutating}
            />
            <p className="mt-2 text-xs text-(--color-text-muted)">
              {copy('Previous payment remains recorded')}
            </p>
            {confirmsReturn ? (
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg bg-(--color-surface) px-3 py-2.5 text-sm">
                <DCheckbox
                  checked={moneyReturned}
                  disabled={isMutating}
                  onChange={() => onMoneyReturnedChange?.(!moneyReturned)}
                />
                <span>
                  {copy('I have returned')} <strong>{money(refundAmount, locale)}</strong>{' '}
                  {copy('to the customer.')}
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
        <label className="mt-5 block text-sm font-medium">
          {copy('Cancellation reason')}
          <DTextarea
            className="mt-1.5 h-10 rounded-lg"
            autoFocus
            value={reason}
            disabled={isMutating}
            onChange={onReasonChange}
            placeholder={copy('Example: Customer request')}
          />
        </label>
      </>
    </Dialog>
  );
}
